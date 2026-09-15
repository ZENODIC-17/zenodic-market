const API = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:3000" : "https://zenodic-market-production.up.railway.app";


const gatewayStep =
  document.getElementById("gatewayStep");

const adminStep =
  document.getElementById("adminStep");

const gatewayForm =
  document.getElementById("gatewayForm");

const adminLoginForm =
  document.getElementById("adminLoginForm");

const gatewayButton =
  document.getElementById("gatewayButton");

const loginButton =
  document.getElementById("loginButton");

const message =
  document.getElementById("message");

const stepSubtitle =
  document.getElementById("stepSubtitle");

const securityText =
  document.getElementById("securityText");

function showMessage(text, type = "") {

  message.textContent = text;

  if (type === "success") {
    message.style.color = "#86efac";
  } else {
    message.style.color = "#fca5a5";
  }

}

document
  .querySelectorAll(".toggle-password")
  .forEach(button => {

    button.addEventListener("click", () => {

      const input =
        document.getElementById(
          button.dataset.target
        );

      const hidden =
        input.type === "password";

      input.type =
        hidden ? "text" : "password";

      button.textContent =
        hidden ? "🙈" : "👁";

    });

  });

gatewayForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const email =
      document
        .getElementById("gatewayEmail")
        .value
        .trim();

    const password =
      document
        .getElementById("gatewayPassword")
        .value;

    if (!email || !password) {

      showMessage(
        "⚠️ Email na password vinahitajika."
      );

      return;
    }

    gatewayButton.disabled = true;
    gatewayButton.textContent =
      "Inathibitisha...";

    showMessage("");

    try {

      const response =
        await fetch(
          API + "/api/admin/gateway-login",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              email,
              password
            })
          }
        );

      const data =
        await response.json();


      if (!response.ok || !data.success) {

        showMessage(
          "❌ " +
          (
            data.message ||
            "Gateway authentication imeshindikana."
          )
        );

        gatewayButton.disabled = false;
        gatewayButton.textContent =
          "Endelea";

        return;
      }

      gatewayStep.style.display = "none";
      adminStep.style.display = "block";

      stepSubtitle.textContent =
        "Admin Sign In";

      securityText.textContent =
        "Gateway imethibitishwa. Endelea na Admin Login.";

      showMessage(
        "✅ Gateway imethibitishwa.",
        "success"
      );

      document
        .getElementById("email")
        .focus();

    } catch (error) {

      console.error(error);

      showMessage(
        "❌ Backend haipatikani."
      );

      gatewayButton.disabled = false;
      gatewayButton.textContent =
        "Endelea";

    }

  }
);

adminLoginForm.addEventListener(
  "submit",
  async event => {
    console.log("ADMIN LOGIN SUBMIT FIRED");

    event.preventDefault();

    const email =
      document
        .getElementById("email")
        .value
        .trim();

    const password =
      document
        .getElementById("password")
        .value;

    if (!email || !password) {

      showMessage(
        "⚠️ Email na password vinahitajika."
      );

      return;
    }

    loginButton.disabled = true;
    loginButton.textContent =
      "Inaingia...";

    showMessage("");

    try {

      const response =
        await fetch(
          API + "/api/admin/login",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              email,
              password
            })
          }
        );

      const data =
        await response.json();

      
if (!response.ok || !data.success) {

        showMessage(
          "❌ " +
          (
            data.message ||
            "Email au password si sahihi."
          )
        );

        loginButton.disabled = false;
        loginButton.textContent =
          "Ingia Admin";

        return;
      }

      /*
       * Dashboard yako ya sasa bado inatumia
       * zenodicAdminToken kupitia sessionStorage.
       * Tunaendelea kui-support kwa hatua hii
       * ili tusivunje dashboard iliyopo.
       */

      if (!data.token) {
        throw new Error("Backend haikutuma admin token.");
      }

      try {
        sessionStorage.setItem("zenodicAdminToken", data.token);
      } catch (storageError) {
        console.error("SESSION STORAGE ERROR:", storageError);
        throw new Error("Browser imekataa kuhifadhi admin session.");
      }

      if (sessionStorage.getItem("zenodicAdminToken") !== data.token) {
        throw new Error("Admin token haijahifadhiwa kwenye browser.");
      }
      console.log("TOKEN SAVED:", !!sessionStorage.getItem("zenodicAdminToken"));
      console.log("TOKEN LENGTH:", data.token ? data.token.length : 0);
      showMessage(
        "DEBUG: Token imehifadhiwa = " +
        (!!sessionStorage.getItem("zenodicAdminToken")) +
        " | length = " +
        (data.token ? data.token.length : 0),
        "success"
      );

      showMessage(
        "✅ Login imefanikiwa. Inafungua Admin...",
        "success"
      );

      loginButton.textContent =
        "Imeingia ✓";

      setTimeout(() => {

        window.location.assign("/admin.html?from=login");

      }, 500);

    } catch (error) {

      console.error(
        "Admin login error:",
        error
      );

      showMessage(
        "❌ Imeshindikana kuwasiliana na backend."
      );

      loginButton.disabled = false;
      loginButton.textContent =
        "Ingia Admin";

    }

  }
);

document
  .getElementById("backToGateway")
  .addEventListener("click", () => {

    adminStep.style.display = "none";
    gatewayStep.style.display = "block";

    stepSubtitle.textContent =
      "Secure Admin Access";

    securityText.textContent =
      "Eneo salama la wasimamizi wa Zenodic";

    showMessage("");

  });

const passkeyButton =
  document.getElementById("passkeyButton");

if (passkeyButton) {
  passkeyButton.addEventListener("click", async () => {
    passkeyButton.disabled = true;
    passkeyButton.textContent = "Inathibitisha Passkey...";
    showMessage("");

    try {
      const optionsResponse = await fetch(
        API + "/api/admin/webauthn/auth/options",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      const optionsData = await optionsResponse.json();

      if (!optionsResponse.ok || !optionsData.success) {
        throw new Error(
          optionsData.message ||
          "Imeshindikana kuandaa Passkey."
        );
      }

      if (
        !window.SimpleWebAuthnBrowser ||
        typeof window.SimpleWebAuthnBrowser.startAuthentication !== "function"
      ) {
        throw new Error(
          "WebAuthn browser library haijapakiwa."
        );
      }

      const credential =
        await window.SimpleWebAuthnBrowser.startAuthentication({
          optionsJSON: optionsData.options
        });

      const verifyResponse = await fetch(
        API + "/api/admin/webauthn/auth/verify",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(credential)
        }
      );

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.success) {
        throw new Error(
          verifyData.message ||
          "Passkey authentication imeshindikana."
        );
      }

      sessionStorage.setItem(
        "zenodicAdminToken",
        verifyData.token
      );

      showMessage(
        "✅ Passkey login imefanikiwa. Inafungua Admin...",
        "success"
      );

      passkeyButton.textContent = "Imeingia ✓";

      setTimeout(() => {
        window.location.assign("/admin.html?from=login");
      }, 500);

    } catch (error) {
      console.error("PASSKEY LOGIN ERROR:", error);

      showMessage(
        "❌ " +
        (error.message || "Passkey login imeshindikana.")
      );

      passkeyButton.disabled = false;
      passkeyButton.textContent = "Ingia kwa Passkey";
    }
  });
}

const registerPasskeyButton =
  document.getElementById("registerPasskeyButton");

if (registerPasskeyButton) {
  registerPasskeyButton.addEventListener("click", async () => {
    registerPasskeyButton.disabled = true;
    registerPasskeyButton.textContent = "Inasajili Passkey...";
    showMessage("");

    try {
      if (
        !window.SimpleWebAuthnBrowser ||
        typeof window.SimpleWebAuthnBrowser.startRegistration !== "function"
      ) {
        throw new Error("WebAuthn browser library haijapakiwa.");
      }

      const optionsResponse = await fetch(
        API + "/api/admin/webauthn/register/options",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      const optionsData = await optionsResponse.json();

      if (!optionsResponse.ok || !optionsData.success) {
        throw new Error(
          optionsData.message ||
          "Imeshindikana kuandaa usajili wa Passkey."
        );
      }

      const credential =
        await window.SimpleWebAuthnBrowser.startRegistration({
          optionsJSON: optionsData.options
        });

      const verifyResponse = await fetch(
        API + "/api/admin/webauthn/register/verify",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(credential)
        }
      );

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.success) {
        throw new Error(
          verifyData.message ||
          "Usajili wa Passkey umeshindikana."
        );
      }

      showMessage(
        "✅ Passkey imesajiliwa kwa mafanikio.",
        "success"
      );

      registerPasskeyButton.textContent = "Passkey Imesajiliwa ✓";

    } catch (error) {
      console.error("PASSKEY REGISTRATION ERROR:", error);

      showMessage(
        "❌ " +
        (error.message || "Usajili wa Passkey umeshindikana.")
      );

      registerPasskeyButton.disabled = false;
      registerPasskeyButton.textContent = "Sajili Passkey";
    }
  });
}

const forgotAdminPasswordBtn = document.getElementById("forgotAdminPasswordBtn");
const forgotAdminPasswordPanel = document.getElementById("forgotAdminPasswordPanel");
const requestAdminPasswordResetBtn = document.getElementById("requestAdminPasswordResetBtn");
const forgotAdminEmail = document.getElementById("forgotAdminEmail");
const forgotAdminPasswordMessage = document.getElementById("forgotAdminPasswordMessage");

if (forgotAdminPasswordBtn && forgotAdminPasswordPanel) {
  forgotAdminPasswordBtn.addEventListener("click", () => {
    forgotAdminPasswordPanel.hidden = !forgotAdminPasswordPanel.hidden;

    if (!forgotAdminPasswordPanel.hidden && forgotAdminEmail) {
      forgotAdminEmail.focus();
    }
  });
}

if (requestAdminPasswordResetBtn) {
  requestAdminPasswordResetBtn.addEventListener("click", async () => {
    const email = String(forgotAdminEmail?.value || "").trim();

    if (!email) {
      if (forgotAdminPasswordMessage) {
        forgotAdminPasswordMessage.textContent =
          "Weka admin email kwanza.";
      }
      return;
    }

    requestAdminPasswordResetBtn.disabled = true;
    requestAdminPasswordResetBtn.textContent = "Inatuma Reset Link...";

    if (forgotAdminPasswordMessage) {
      forgotAdminPasswordMessage.textContent = "";
    }

    try {
      const response = await fetch(
        API + "/api/admin/password-reset/request",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Password reset request imeshindikana."
        );
      }

      if (forgotAdminPasswordMessage) {
        forgotAdminPasswordMessage.textContent =
          "✅ Ikiwa email hiyo ni ya admin, reset link imetumwa.";
        forgotAdminPasswordMessage.style.color = "#15803d";
      }

      if (forgotAdminEmail) {
        forgotAdminEmail.value = "";
      }
    } catch (error) {
      console.error("ADMIN PASSWORD RESET REQUEST ERROR:", error);

      if (forgotAdminPasswordMessage) {
        forgotAdminPasswordMessage.textContent =
          "❌ Imeshindikana kuomba password reset.";
        forgotAdminPasswordMessage.style.color = "#b91c1c";
      }
    } finally {
      requestAdminPasswordResetBtn.disabled = false;
      requestAdminPasswordResetBtn.textContent =
        "📧 Request Reset Link";
    }
  });
}
