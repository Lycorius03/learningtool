/**
 * PaperLens — Admin Entrance (hidden keyboard chord detector)
 * Triggers on Ctrl+Shift+Alt+E, shows login modal.
 */
import { showToast } from '../../utils/toast.js';

export class AdminEntrance {
  constructor(state) {
    this.state = state;

    // Listen for key chord: Ctrl+Shift+Alt+E
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.altKey && e.key === 'E') {
        e.preventDefault();
        this._showModal();
      }
    });

    // Modal event listeners
    this._setupModal();
  }

  _setupModal() {
    const modal = document.getElementById('adminModal');
    const cancelBtn = document.getElementById('adminCancel');
    const submitBtn = document.getElementById('adminSubmit');
    if (!modal || !cancelBtn || !submitBtn) return;

    cancelBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    submitBtn.addEventListener('click', () => this._handleLogin());
  }

  _showModal() {
    if (this.state.isAdmin) {
      showToast('已处于管理员模式', 'info');
      return;
    }
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminModal').style.display = 'flex';
    setTimeout(() => document.getElementById('adminUsername').focus(), 100);
  }

  async _handleLogin() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();

    if (!username || !password) {
      showToast('请输入账号和密码', 'warning');
      return;
    }

    const submitBtn = document.getElementById('adminSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = '验证中...';

    try {
      await this.state.login(username, password);
      document.getElementById('adminModal').style.display = 'none';
      showToast('管理员验证成功', 'success');
    } catch (err) {
      showToast(err.message || '验证失败', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '验证';
    }
  }
}
