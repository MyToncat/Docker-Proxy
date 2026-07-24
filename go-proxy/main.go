package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// adminPasswordSentinel is the value the UI sends back when the password field
// was left untouched (it shows "********" as a placeholder). The server then
// keeps the existing password instead of overwriting it.
const adminPasswordSentinel = "********"

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: registry-proxy <config.yaml>")
		os.Exit(2)
	}
	configPath := os.Args[1]
	cfg, err := loadConfig(configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	adminToken := os.Getenv("GO_PROXY_ADMIN_TOKEN")

	proxy := NewProxy(cfg)

	// --- Registry proxy server (the public-facing :5000) ---
	registryAddr := cfg.Server.Listen
	if registryAddr == "" {
		registryAddr = ":5000"
	}
	go func() {
		log.Printf("registry proxy listening on %s", registryAddr)
		if err := http.ListenAndServe(registryAddr, proxy); err != nil {
			log.Fatalf("registry proxy error: %v", err)
		}
	}()

	// --- Management API server (internal :5001, never publicly exposed) ---
	adminAddr := cfg.Server.AdminListen
	if adminAddr == "" {
		adminAddr = ":5001"
	}
	adminMux := http.NewServeMux()
	adminMux.HandleFunc("/-/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	adminMux.HandleFunc("/-/config", func(w http.ResponseWriter, r *http.Request) {
		handleAdminConfig(w, r, proxy, configPath, adminToken)
	})
	adminMux.HandleFunc("/-/reload", func(w http.ResponseWriter, r *http.Request) {
		handleAdminReload(w, r, proxy, configPath, adminToken)
	})
	adminMux.HandleFunc("/-/stats", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Query().Get("reset") == "1" {
			proxy.resetStats()
			writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "reset": true})
			return
		}
		if r.Method != http.MethodGet {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"clients": proxy.snapshotStats(),
		})
	})

	adminHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// /-/healthz is a public liveness probe (no token required).
		if r.URL.Path == "/-/healthz" {
			adminMux.ServeHTTP(w, r)
			return
		}
		if adminToken != "" {
			tok := r.Header.Get("X-Admin-Token")
			if tok == "" {
				tok = r.URL.Query().Get("token")
			}
			if tok != adminToken {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
		}
		adminMux.ServeHTTP(w, r)
	})

	log.Printf("management API listening on %s", adminAddr)
	if err := http.ListenAndServe(adminAddr, adminHandler); err != nil {
		log.Fatalf("management API error: %v", err)
	}
}

// handleAdminConfig implements GET (return current config, passwords masked) and
// PUT (replace config: validate, write YAML, hot-reload).
func handleAdminConfig(w http.ResponseWriter, r *http.Request, proxy *Proxy, configPath, adminToken string) {
	switch r.Method {
	case http.MethodGet:
		proxy.routeMux.RLock()
		out := *proxy.cfg
		proxy.routeMux.RUnlock()
		// Mask passwords so they never leave the server.
		for i := range out.Registries {
			if out.Registries[i].Auth.Password != "" {
				out.Registries[i].Auth.Password = adminPasswordSentinel
			}
		}
		writeJSON(w, http.StatusOK, out)

	case http.MethodPut:
		var incoming Config
		if err := json.NewDecoder(r.Body).Decode(&incoming); err != nil {
			writeJSONError(w, http.StatusBadRequest, "无效的 JSON: "+err.Error())
			return
		}
		if err := validateConfig(&incoming); err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		normalizeConfig(&incoming)
		// Preserve existing passwords when the UI sent the sentinel placeholder.
		proxy.routeMux.RLock()
		current := proxy.cfg
		proxy.routeMux.RUnlock()
		for i := range incoming.Registries {
			if incoming.Registries[i].Auth.Password == adminPasswordSentinel {
				// find matching current registry by name and keep its password
				for j := range current.Registries {
					if current.Registries[j].Name == incoming.Registries[i].Name {
						incoming.Registries[i].Auth.Password = current.Registries[j].Auth.Password
						break
					}
				}
			}
		}
		if err := saveConfig(configPath, &incoming); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "保存配置失败: "+err.Error())
			return
		}
		proxy.reload(&incoming)
		log.Printf("config updated via management API (%d registries)", len(incoming.Registries))
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "registries": len(incoming.Registries)})

	default:
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// handleAdminReload re-reads the on-disk config file and hot-reloads.
func handleAdminReload(w http.ResponseWriter, r *http.Request, proxy *Proxy, configPath, adminToken string) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	cfg, err := loadConfig(configPath)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "重新加载失败: "+err.Error())
		return
	}
	proxy.reload(cfg)
	log.Printf("config reloaded from disk via management API (%d registries)", len(cfg.Registries))
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "registries": len(cfg.Registries)})
}

// validateConfig performs basic sanity checks on a config submitted via the UI.
func validateConfig(cfg *Config) error {
	if len(cfg.Registries) == 0 {
		return fmt.Errorf("至少需要配置一个 registry")
	}
	if err := validateAccessControl(&cfg.AccessControl); err != nil {
		return err
	}
	names := make(map[string]bool)
	for _, r := range cfg.Registries {
		if r.Name == "" {
			return fmt.Errorf("存在 registry 缺少 name")
		}
		if names[r.Name] {
			return fmt.Errorf("registry name 重复: %s", r.Name)
		}
		names[r.Name] = true
		if len(r.Hosts) == 0 {
			return fmt.Errorf("registry %s 至少需要一个 host", r.Name)
		}
		if r.Upstream == "" {
			return fmt.Errorf("registry %s 缺少 upstream", r.Name)
		}
		if _, err := url.Parse(r.Upstream); err != nil {
			return fmt.Errorf("registry %s 的 upstream 不是合法 URL: %w", r.Name, err)
		}
		switch r.Auth.Type {
		case "", AuthToken, AuthAnonymous, AuthBasic:
		default:
			return fmt.Errorf("registry %s 的 auth.type 非法: %s", r.Name, r.Auth.Type)
		}
	}
	return nil
}

// validateAccessControl checks the IP allow/deny configuration. Invalid IPs or
// CIDRs are rejected here so a bad rule can never fail silently (unlike the old
// iptables batch apply, where one bad entry broke the whole batch).
func validateAccessControl(ac *AccessControl) error {
	switch ac.Mode {
	case "", ACLModeOff, ACLModeWhitelist, ACLModeBlacklist:
	default:
		return fmt.Errorf("access_control.mode 非法: %q (应为 off / whitelist / blacklist)", ac.Mode)
	}
	if ac.Mode == ACLModeWhitelist && len(ac.Whitelist) == 0 {
		return fmt.Errorf("白名单模式至少需要配置一个 IP/CIDR")
	}
	for _, e := range ac.Whitelist {
		if err := checkIPRule(e); err != nil {
			return err
		}
	}
	for _, e := range ac.Blacklist {
		if err := checkIPRule(e); err != nil {
			return err
		}
	}
	return nil
}

// checkIPRule validates a single allow/deny entry: a plain IP or a CIDR, with
// an optional inline "# comment".
func checkIPRule(raw string) error {
	e := strings.TrimSpace(raw)
	if e == "" {
		return fmt.Errorf("存在空的 IP 规则")
	}
	if i := strings.IndexByte(e, '#'); i >= 0 {
		e = strings.TrimSpace(e[:i])
	}
	if e == "" {
		return nil
	}
	if _, _, err := net.ParseCIDR(e); err == nil {
		return nil
	}
	if net.ParseIP(e) != nil {
		return nil
	}
	return fmt.Errorf("非法的 IP/CIDR: %q", raw)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
