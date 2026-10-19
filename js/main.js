const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
if (toggle && links) {
  toggle.addEventListener('click', () => links.classList.toggle('open'));
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

const form = document.getElementById('contact-form');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('form-msg').textContent = 'Thanks! We will get back to you soon.';
    form.reset();
  });
}