document.querySelector('.password-toggle')?.addEventListener('click', e => {
  const i = document.querySelector('[name=password]');
  i.type = i.type === 'password' ? 'text' : 'password';
});
document.querySelector('#auth-form').addEventListener('submit', e => {
  const p = document.querySelector('[name=password]').value;
  const c = document.querySelector('[name=confirm_password]').value;
  if (p !== c) {
    e.preventDefault();
    MFP.toast('Passwords do not match.', 'error');
  }
});
