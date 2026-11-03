
const form = document.getElementById("auth-form");
const tabs = document.querySelectorAll(".auth-tab");
const title = document.getElementById("auth-title");
const description = document.getElementById("auth-description");
const submitLabel = document.getElementById("submit-label");
const nameField = document.getElementById("name-field");
const confirmField = document.getElementById("confirm-field");
const forgotButton = document.getElementById("forgot-password");
const message = document.getElementById("auth-message");
const googleButton = document.getElementById("google-signin");

let mode = "login";

function setMessage(text, type = "error") {
  message.textContent = text;
  message.style.color = type === "success"
    ? "var(--status-online)"
    : "var(--status-danger)";
}

function clearErrors() {
  document.querySelectorAll(".field-error").forEach((element) => {
    element.textContent = "";
  });

  document.querySelectorAll(".field-group input").forEach((input) => {
    input.classList.remove("invalid");
  });
}

function showError(field, text) {
  const error = document.querySelector(`[data-error="${field}"]`);
  const inputId = {
    displayName: "display-name",
    confirmPassword: "confirm-password"
  }[field] || field;

  const input = document.getElementById(inputId);

  if (error) error.textContent = text;
  if (input) input.classList.add("invalid");
}

function setMode(nextMode) {
  mode = nextMode;

  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });

  const isRegister = mode === "register";

  nameField.hidden = !isRegister;
  confirmField.hidden = !isRegister;
  forgotButton.hidden = isRegister;

  title.textContent = isRegister ? "إنشاء حساب جديد" : "تسجيل الدخول";
  description.textContent = isRegister
    ? "أنشئ حسابك وابدأ رحلتك مع NOVA."
    : "سجّل دخولك للمتابعة إلى حسابك.";

  submitLabel.textContent = isRegister
    ? "إنشاء الحساب"
    : "تسجيل الدخول";

  document.getElementById("password").autocomplete =
    isRegister ? "new-password" : "current-password";

  clearErrors();
  setMessage("");
}

function validate() {
  clearErrors();

  const name = document.getElementById("display-name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword =
    document.getElementById("confirm-password").value;

  let valid = true;

  if (mode === "register" && name.length < 2) {
    showError("displayName", "اكتب اسماً مكوناً من حرفين على الأقل.");
    valid = false;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("email", "اكتب بريداً إلكترونياً صحيحاً.");
    valid = false;
  }

  if (password.length < 8) {
    showError("password", "كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
    valid = false;
  }

  if (mode === "register" && password !== confirmPassword) {
    showError("confirmPassword", "كلمتا المرور غير متطابقتين.");
    valid = false;
  }

  return valid;
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  setMessage("");

  if (!validate()) return;

  setMessage(
    "لم يتم تفعيل تسجيل الحساب بعد. سنربطه بخدمة Firebase Authentication."
  );
});

googleButton.addEventListener("click", () => {
  setMessage(
    "تسجيل الدخول باستخدام Google جاهز في الواجهة، ويلزم تفعيل Google Provider وإعداد Firebase لإكمال الربط."
  );
});

forgotButton.addEventListener("click", () => {
  setMessage(
    "استعادة كلمة المرور ستُفعّل بعد ربط Firebase Authentication."
  );
});

form.addEventListener("input", () => setMessage(""));

window.NovaAuth = { setMode };
