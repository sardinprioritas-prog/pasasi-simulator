/**
 * AeroCheck Simulator — Auth Module
 * Session stored in sessionStorage (clears on browser close).
 */

const Auth = (() => {
  const KEY = 'aerocheck_session';

  return {
    async login(agentId, password) {
      const user = await DB.getAgentByCredentials(agentId, password);
      if (!user) return null;
      const session = {
        id:        user.id,
        agentId:   user.agentId,
        name:      user.name,
        role:      user.role,
        loginTime: new Date().toISOString(),
      };
      sessionStorage.setItem(KEY, JSON.stringify(session));
      return session;
    },

    logout() {
      sessionStorage.removeItem(KEY);
      const isInPages = window.location.pathname.includes('/pages/');
      window.location.href = isInPages ? '../index.html' : 'index.html';
    },

    getSession() {
      try { return JSON.parse(sessionStorage.getItem(KEY)) || null; }
      catch { return null; }
    },

    /** Redirects to login if not authenticated. Returns true if OK. */
    requireAuth() {
      const s = this.getSession();
      if (!s) {
        const isInPages = window.location.pathname.includes('/pages/');
        window.location.href = isInPages ? '../index.html' : 'index.html';
        return false;
      }
      return true;
    },

    /** Redirects if wrong role. Returns true if OK. */
    requireRole(role) {
      if (!this.requireAuth()) return false;
      const s = this.getSession();
      if (s.role !== role) {
        window.location.href = s.role === 'admin' ? 'admin.html' : 'agent.html';
        return false;
      }
      return true;
    },

    isAdmin()  { return this.getSession()?.role === 'admin'; },
    isAgent()  { return this.getSession()?.role === 'agent'; },
  };
})();
