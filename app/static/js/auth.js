/* Auth page logic */

function switchAuthTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

function togglePassword(inputId) {
  const el = document.getElementById(inputId);
  el.type = el.type === 'password' ? 'text' : 'password';
}

function setAuthLoading(btn, spinning, errId) {
  btn.disabled = spinning;
  btn.querySelector('.btn-text').classList.toggle('hidden', spinning);
  btn.querySelector('.btn-spinner').classList.toggle('hidden', !spinning);
  if (errId) document.getElementById(errId).classList.add('hidden');
}

function showAuthError(errId, msg) {
  const el = document.getElementById(errId);
  el.textContent = msg; el.classList.remove('hidden');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  setAuthLoading(btn, true, 'login-error');
  try {
    const data = await API.login(
      document.getElementById('login-email').value.trim(),
      document.getElementById('login-password').value
    );
    setToken(data.access_token);
    setUser(data.user);
    initApp(data.user);
  } catch (err) {
    showAuthError('login-error', err.message);
  } finally {
    setAuthLoading(btn, false, null);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('reg-btn');
  setAuthLoading(btn, true, 'reg-error');
  try {
    const payload = {
      name: document.getElementById('reg-name').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      role: document.getElementById('reg-role').value,
      employee_id: document.getElementById('reg-empid').value.trim() || null,
      department: document.getElementById('reg-dept').value.trim() || null,
    };
    const data = await API.register(payload);
    setToken(data.access_token);
    setUser(data.user);
    initApp(data.user);
  } catch (err) {
    showAuthError('reg-error', err.message);
  } finally {
    setAuthLoading(btn, false, null);
  }
}

function handleLogout() {
  clearToken();
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('auth-overlay').classList.remove('hidden');
}
