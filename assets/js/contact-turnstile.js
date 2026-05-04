(function () {
  var form = null;
  var submitButton = null;
  var originalButtonText = 'Send Message';
  var widgetId = null;
  var submittingWithToken = false;

  function getResponseInput() {
    var responseInput = form.querySelector('input[name="cf-turnstile-response"]');

    if (!responseInput) {
      responseInput = document.createElement('input');
      responseInput.type = 'hidden';
      responseInput.name = 'cf-turnstile-response';
      form.appendChild(responseInput);
    }

    return responseInput;
  }

  function clearResponseInput() {
    var responseInput = form && form.querySelector('input[name="cf-turnstile-response"]');

    if (responseInput) {
      responseInput.value = '';
    }
  }

  function resetSubmitButton() {
    if (!submitButton) return;

    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }

  function submitWithToken(token) {
    getResponseInput().value = token;
    submittingWithToken = true;
    HTMLFormElement.prototype.submit.call(form);
  }

  function renderTurnstile() {
    if (!form || !window.turnstile || widgetId !== null) return;

    widgetId = window.turnstile.render('#contact-turnstile', {
      sitekey: form.getAttribute('data-turnstile-site-key'),
      execution: 'execute',
      appearance: 'execute',
      callback: submitWithToken,
      'expired-callback': clearResponseInput,
      'error-callback': resetSubmitButton,
      'timeout-callback': resetSubmitButton
    });
  }

  window.onContactTurnstileLoad = renderTurnstile;

  document.addEventListener('DOMContentLoaded', function () {
    form = document.getElementById('contact-form');
    submitButton = document.getElementById('contact-submit');

    if (!form || !submitButton) return;

    originalButtonText = submitButton.textContent.trim();
    renderTurnstile();

    form.addEventListener('submit', function (event) {
      if (submittingWithToken) return;

      event.preventDefault();

      if (!window.turnstile || widgetId === null) {
        resetSubmitButton();
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Checking...';
      clearResponseInput();
      window.turnstile.reset(widgetId);
      window.turnstile.execute(widgetId);
    });
  });
}());
