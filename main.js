/* =========================================================
   ZENODIC — Main Frontend Controller
   ========================================================= */

(() => {
  "use strict";

  /* ---------- STATE ---------- */

  const state = {
    language: localStorage.getItem("zenodic_language") || "sw",
    role: localStorage.getItem("zenodic_role") || "",
    user: null
  };

  /* ---------- API ---------- */
const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://zenodic-market-production.up.railway.app";

/* ---------- HELPERS ---------- */

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  function show(id) {
    $$(".page").forEach((page) => {
      page.classList.remove("active");
    });

    const target = document.getElementById(id);

    if (target) {
      target.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function saveState() {
    localStorage.setItem("zenodic_language", state.language);

    if (state.role) {
      localStorage.setItem("zenodic_role", state.role);
    }

    if (state.user) {
      localStorage.setItem(
        "zenodic_user",
        JSON.stringify(state.user)
      );
    } else {
      localStorage.removeItem("zenodic_user");
    }
  }

  /* ---------- INTRO ---------- */

  function startIntro() {
    const intro = $("#intro");
    const home = $("#home");

    if (!intro) return;

    // Hakikisha Welcome imefichwa kabisa wakati Intro inaanza
    if (home) {
      home.classList.remove("active");
    }

    setTimeout(() => {
      intro.classList.add("hide");

      setTimeout(() => {
        intro.style.display = "none";
        show("home");
      }, 800);
    }, 2200);
  }

  /* ---------- LANGUAGE ---------- */

  const translations = {
    sw: {
      homeTitle: "Biashara ya kesho, leo.",
      homeText:
        "ZENODIC inaunganisha wanunuzi na wauzaji katika marketplace ya kisasa, salama na yenye akili.",
      start: "Anza ZENODIC",
      login: "Ingia",
      register: "Jisajili",
      buyer: "Buyer",
      seller: "Seller",
      email: "Barua pepe",
      password: "Password",
      continue: "Endelea",
      logout: "Toka"
    },

    en: {
      homeTitle: "The business of tomorrow, today.",
      homeText:
        "ZENODIC connects buyers and sellers through a modern, secure and intelligent marketplace.",
      start: "Start ZENODIC",
      login: "Login",
      register: "Register",
      buyer: "Buyer",
      seller: "Seller",
      email: "Email",
      password: "Password",
      continue: "Continue",
      logout: "Logout"
    }
  };

  function setLanguage(language) {
    if (!translations[language]) return;

    state.language = language;
    saveState();

    document.documentElement.lang = language;

    $$("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      const value = translations[language][key];

      if (value) {
        element.textContent = value;
      }
    });

    $$(".language-btn").forEach((button) => {
      const buttonLanguage =
        button.dataset.lang || button.dataset.language;

      button.classList.toggle(
        "active",
        buttonLanguage === language
      );
    });

    /*
     * ZENODIC LANGUAGE SYSTEM
     * Elements without data-i18n can use data-sw/data-en.
     */
    $$("[data-sw][data-en]").forEach((element) => {
      const value =
        language === "en"
          ? element.dataset.en
          : element.dataset.sw;

      if (value) {
        element.textContent = value;
      }
    });
  }

  /* ---------- NAVIGATION ---------- */

  function setBuyerSectionView(sectionId = "") {
  const buyerSections = ["market", "orders", "cart"];

  const dashboard = document.getElementById("buyerDashboard");

  if (dashboard) {
    dashboard.classList.toggle(
      "buyer-subpage-active",
      Boolean(sectionId)
    );
  }

  buyerSections.forEach((id) => {
    const section = document.getElementById(id);

    if (!section) return;

    section.style.display =
      sectionId === id ? "block" : "none";
  });
}

function setupNavigation() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-page], [data-nav]");

    if (!button) return;

    const page = button.dataset.page || button.dataset.nav;

    if (!page) return;

    event.preventDefault();

    /*
     * BUYER DASHBOARD NAVIGATION
     * Overview, Market, Orders and Cart are nested
     * inside #buyerDashboard.
     */
    const buyerSections = ["market", "orders", "cart"];

    if (buyerSections.includes(page)) {
      const buyerDashboard =
        document.getElementById("buyerDashboard");

      if (!buyerDashboard) {
        console.warn("Buyer dashboard not found.");
        return;
      }

      $$(".page").forEach((item) => {
        item.classList.remove("active");
      });

      buyerDashboard.classList.add("active");

      setBuyerSectionView(page);

      const target = document.getElementById(page);

      if (target) {
        target.style.display = "block";

        window.requestAnimationFrame(() => {
          target.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        });
      }

      if (
        page === "orders" &&
        typeof window.setupBuyerOrdersRefresh === "function"
      ) {
        window.setupBuyerOrdersRefresh();
      }

      return;
    }

    /*
     * Returning to Buyer Overview.
     */
    if (page === "buyerDashboard") {
      const buyerDashboard =
        document.getElementById("buyerDashboard");

      if (buyerDashboard) {
        $$(".page").forEach((item) => {
          item.classList.remove("active");
        });

        buyerDashboard.classList.add("active");

        setBuyerSectionView("");

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });

        if (
          typeof window.refreshBuyerOverview === "function"
        ) {
          window.refreshBuyerOverview();
        }

        return;
      }
    }

    /*
     * Normal top-level pages.
     */
    show(page);

    const authTab = button.dataset.authTab;

    if (page === "auth" && authTab) {
      const tab = document.querySelector(
        `[data-auth-tab="${authTab}"]`
      );

      if (tab) {
        tab.click();
      }
    }
  });

  $$(".language-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const language =
        button.getAttribute("data-lang") ||
        button.getAttribute("data-language");

      if (language) {
        setLanguage(language);
      }
    });
  });
}


function setupRoles() {
    $$(".role-card").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const role = button.dataset.role;
        if (!role) return;

        state.role = role;
        saveState();

        $$(".role-card").forEach((item) => {
          item.classList.remove("selected");
        });

        button.classList.add("selected");

        const roleInput = $("#registerRole");
        if (roleInput) {
          roleInput.value = role;
        }
      });
    });
  }

  /* ---------- AUTH TABS ---------- */
  function setupAuthTabs() {
    const loginTab = $('[data-auth-tab="login"]');
    const registerTab = $('[data-auth-tab="register"]');

    const loginForm = $("#loginForm");
    const registerForm = $("#registerForm");

    if (!loginTab && !registerTab) return;

    loginTab?.addEventListener("click", () => {
      loginTab.classList.add("active");
      registerTab?.classList.remove("active");

      loginForm?.classList.add("active");
      registerForm?.classList.remove("active");

      const roleStep = $("#registerRoleStep");
      const detailsStep = $("#registerDetailsStep");

      if (roleStep) roleStep.style.display = "block";
      if (detailsStep) detailsStep.style.display = "none";
    });

    registerTab?.addEventListener("click", () => {
      registerTab.classList.add("active");
      loginTab?.classList.remove("active");

      registerForm?.classList.add("active");
      loginForm?.classList.remove("active");

      const roleStep = $("#registerRoleStep");
      const detailsStep = $("#registerDetailsStep");

      if (roleStep) roleStep.style.display = "block";
      if (detailsStep) detailsStep.style.display = "none";
    });
  }

  /* ---------- PASSWORD VISIBILITY ---------- */

  function setupPasswordToggle() {
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-password-toggle]");

      if (!button) return;

      const targetId = button.dataset.passwordToggle;
      const input = document.getElementById(targetId);

      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        button.textContent = "Hide";
      } else {
        input.type = "password";
        button.textContent = "Show";
      }
    });
  }

  /* ---------- EMAIL LOGIN ---------- */

  function setupLogin() {
    const form = $("#loginForm");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = $("#loginEmail")?.value.trim().toLowerCase();
      const password = $("#loginPassword")?.value;

      const message = (sw, en) =>
        alert(state.language === "sw" ? sw : en);

      if (!email || !password) {
        message(
          "Tafadhali jaza barua pepe na password.",
          "Please enter your email and password."
        );
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.dataset.originalText = submitButton.textContent;
        submitButton.textContent =
          state.language === "sw" ? "Inaingia..." : "Logging in...";
      }

      try {
        const response = await fetch(API_BASE + "/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            password
          })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
            (state.language === "sw"
              ? "Email au password si sahihi."
              : "Invalid email or password.")
          );
        }

        state.user = data.user;
        state.role = data.user.role;
        saveState();

        form.reset();

        /*
         * Fungua dashboard kulingana na role
         */
        if (data.user.role === "buyer") {
          show("buyerDashboard");
        } else if (data.user.role === "seller") {
          show("sellerDashboard");
        } else if (data.user.role === "wholesale") {
          show("wholesaleDashboard");
        } else {
          show("home");
        }

      } catch (error) {
        console.error("Login error:", error);

        message(
          error.message || "Login imeshindikana.",
          error.message || "Login failed."
        );

      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent =
            submitButton.dataset.originalText || "Ingia";
        }
      }
    });
  }

  /* ---------- REGISTER ROLE STEP ---------- */
  function setupRegisterRoleStep() {
    const continueBtn = $("#continueRegister");
    const backBtn = $("#backToRole");
    const roleStep = $("#registerRoleStep");
    const detailsStep = $("#registerDetailsStep");
    const roleInput = $("#registerRole");
    const selectedRoleText = $("#selectedRoleText");

    if (!continueBtn || !roleStep || !detailsStep || !roleInput) return;

    $$(".role-card").forEach((card) => {
      card.addEventListener("click", () => {
        const role = card.dataset.role;
        if (!role) return;

        roleInput.value = role;
        state.role = role;
        saveState();

        $$(".role-card").forEach((item) => {
          item.classList.remove("selected");
        });

        card.classList.add("selected");

        if (selectedRoleText) {
          selectedRoleText.textContent =
            role === "buyer" ? "Buyer Account" : "Seller Account";
        }
      });
    });

    continueBtn.addEventListener("click", () => {
      if (!roleInput.value) {
        alert(
          state.language === "sw"
            ? "Tafadhali chagua Buyer au Seller kwanza."
            : "Please choose Buyer or Seller first."
        );
        return;
      }

      roleStep.style.display = "none";
      detailsStep.style.display = "block";

      $("#registerName")?.focus();
    });

    backBtn?.addEventListener("click", () => {
      detailsStep.style.display = "none";
      roleStep.style.display = "block";
    });
  }

  /* ---------- REGISTER ---------- */

  function setupRegister() {
    const form = $("#registerForm");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = $("#registerName")?.value.trim();
      const email = $("#registerEmail")?.value.trim().toLowerCase();
      const password = $("#registerPassword")?.value;
      const role = $("#registerRole")?.value || state.role;

      const message = (sw, en) =>
        alert(state.language === "sw" ? sw : en);

      if (!name || !email || !password || !role) {
        message(
          "Jaza taarifa zote na uchague Buyer, Seller au Wholesale.",
          "Complete all fields and choose Buyer, Seller or Wholesale."
        );
        return;
      }

      const allowedRoles = ["buyer", "seller", "wholesale"];

      if (!allowedRoles.includes(role)) {
        message(
          "Aina ya akaunti si sahihi.",
          "Invalid account type."
        );
        return;
      }

      if (password.length < 8) {
        message(
          "Password iwe na angalau herufi 8.",
          "Password must be at least 8 characters."
        );
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.dataset.originalText = submitButton.textContent;
        submitButton.textContent =
          state.language === "sw" ? "Inasajili..." : "Registering...";
      }

      try {
        const response = await fetch(API_BASE + "/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name,
            email,
            password,
            role
          })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
            (state.language === "sw"
              ? "Usajili umeshindikana."
              : "Registration failed.")
          );
        }

        state.role = role;
        saveState();

        message(
          "Akaunti yako imetengenezwa vizuri. Sasa unaweza kuingia.",
          "Your account has been created successfully. You can now log in."
        );

        form.reset();

        const roleInput = $("#registerRole");
        if (roleInput) roleInput.value = "";

        $$(".role-card").forEach((card) => {
          card.classList.remove("selected");
        });

        const roleStep = $("#registerRoleStep");
        const detailsStep = $("#registerDetailsStep");

        if (detailsStep) detailsStep.style.display = "none";
        if (roleStep) roleStep.style.display = "block";

      } catch (error) {
        console.error("Registration error:", error);

        message(
          error.message || "Usajili umeshindikana.",
          error.message || "Registration failed."
        );

      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent =
            submitButton.dataset.originalText || "Jisajili";
        }
      }
    });
  }

  /* ---------- SOCIAL AUTH ---------- */

  function setupSocialAuth() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-provider]");

      if (!button) return;

      const provider = button.dataset.provider;

      if (!provider) return;

      /*
       * OAuth providers:
       * Google
       * Facebook
       * Instagram
       *
       * Tutaziunganisha kupitia backend/OAuth
       * badala ya kuhifadhi passwords kwenye frontend.
       */

      alert(
        state.language === "sw"
          ? `${provider} login itaunganishwa na OAuth backend.`
          : `${provider} login will be connected through the OAuth backend.`
      );
    });
  }

  /* ---------- DASHBOARD ---------- */

  function openDashboard(role) {
    state.role = role;
    saveState();

    if (role === "buyer") {
      show("buyerDashboard");
      return;
    }

    if (role === "seller") {
      show("sellerDashboard");
    }
  }

  function setupDashboardButtons() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-dashboard-role]");

      if (!button) return;

      openDashboard(button.dataset.dashboardRole);
    });
  }

  /* ---------- MARKETPLACE ---------- */

  function setupMarketplace() {
  function loadBuyerMarket() {
    const marketProducts = document.getElementById("marketProducts");
    if (!marketProducts) return;

    marketProducts.innerHTML = `
      <div class="buyer-empty-state">
        Inapakia bidhaa za Market...
      </div>
    `;

    fetch(API_BASE + "/api/inventory/market", {
      credentials: "include"
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message || "Imeshindikana kupakia Market."
          );
        }

        return data;
      })
      .then((data) => {
        const products = Array.isArray(data.products)
          ? data.products
          : [];

        if (!products.length) {
          marketProducts.innerHTML = `
            <div class="buyer-empty-state">
              <strong>Hakuna bidhaa zilizo tayari kwa Market.</strong>
              <span>
                Bidhaa huonekana hapa baada ya seller/wholesaler
                kuthibitishwa na admin na bidhaa ku-approve.
              </span>
            </div>
          `;
          return;
        }

        marketProducts.innerHTML = products
          .map((product) => {
            const price = Number(product.price || 0);
            const quantity = Math.max(
              0,
              Number(product.quantity || 0) -
              Number(product.reserved_quantity || 0)
            );

            const icon = product.image_url
              ? `<img src="${escapeCartText(product.image_url)}" alt="${escapeCartText(product.item_name)}" loading="lazy">`
              : "📦";

      const video = product.video_url
        ? `<video src="${escapeCartText(product.video_url)}" controls playsinline preload="metadata" style="width:100%;max-height:240px;border-radius:12px;margin-top:10px;" aria-label="Video ya ${escapeCartText(product.item_name)}"></video>`
        : "";

            return `
              <article class="product-card">
                <div class="product-image">
                  ${icon}
                  ${video}
                </div>

                <div class="product-info">
                  <h3>${escapeCartText(product.item_name)}</h3>

                  <div class="price">
                    ${formatMoney(price)}
                  </div>

                  <div class="product-category">
                    ${escapeCartText(product.item_type || "Product")}
                  </div>

                  <small>
                    ${escapeCartText(product.seller_name || "Seller")}
                    · ${escapeCartText(product.seller_role || "seller")}
                    · Stock: ${quantity}
                  </small>

                  <button
                    type="button"
                    class="buy-btn"
                    data-product-action="cart"
                    data-product-id="${escapeCartText(product.id)}"
                    data-product-name="${escapeCartText(product.item_name)}"
                    data-product-price="${price}"
                    data-product-category="${escapeCartText(product.item_type || "Product")}"
                    style="width:100%;margin-top:14px;"
                  >
                    Nunua
                  </button>
                </div>
              </article>
            `;
          })
          .join("");
      })
      .catch((error) => {
        console.error("BUYER MARKET ERROR:", error);

        marketProducts.innerHTML = `
          <div class="buyer-empty-state">
            <strong>Market haikupatikana.</strong>
            <span>${escapeCartText(error.message)}</span>
          </div>
        `;
      });
  }

  const CART_KEY = "zenodic_buyer_cart";

  function getCart() {
    try {
      const saved = localStorage.getItem(CART_KEY);
      const cart = saved ? JSON.parse(saved) : [];
      return Array.isArray(cart) ? cart : [];
    } catch (error) {
      console.warn("Cart load error:", error);
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat("en-TZ", {
      style: "currency",
      currency: "TZS",
      minimumFractionDigits: 0
    }).format(Number(amount || 0));
  }

  function escapeCartText(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateCartCount(cart) {
    const count = cart.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );

    const countElement = document.getElementById("cartCount");

    if (countElement) {
      countElement.textContent = count;
    }

    document.querySelectorAll("[data-cart-count]").forEach((element) => {
      element.textContent = count;
    });
  }

  function calculateCartTotal(cart) {
    return cart.reduce(
      (sum, item) =>
        sum +
        Number(item.price || 0) *
          Number(item.quantity || 0),
      0
    );
  }

  function renderCart() {
    const cartBox = document.querySelector("#cart .cart-box");

    if (!cartBox) return;

    const cart = getCart();

    updateCartCount(cart);

    const total = calculateCartTotal(cart);

    cartBox.innerHTML = `
      <div class="cart-header">
        <div>
          <span class="buyer-panel-kicker">SHOPPING CART</span>
          <h2>🛍️ Your Cart</h2>
        </div>

        <span id="cartCount" class="cart-count-badge">
          ${cart.reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0
          )}
        </span>
      </div>

      ${
        cart.length
          ? `
            <div class="buyer-cart-items">
              ${cart
                .map(
                  (item) => `
                    <div class="buyer-cart-item">

                      <div class="buyer-cart-item-icon">
                        ${escapeCartText(item.icon || "📦")}
                      </div>

                      <div class="buyer-cart-item-info">
                        <strong>${escapeCartText(item.name)}</strong>
                        <span>${escapeCartText(item.category || "Product")}</span>
                        <small>${formatMoney(item.price)} each</small>
                      </div>

                      <div class="buyer-cart-item-controls">
                        <button
                          type="button"
                          class="buyer-cart-qty-btn"
                          data-cart-minus="${escapeCartText(item.id)}"
                        >−</button>

                        <strong>${Number(item.quantity || 0)}</strong>

                        <button
                          type="button"
                          class="buyer-cart-qty-btn"
                          data-cart-plus="${escapeCartText(item.id)}"
                        >+</button>
                      </div>

                      <div class="buyer-cart-item-total">
                        <strong>
                          ${formatMoney(
                            Number(item.price || 0) *
                            Number(item.quantity || 0)
                          )}
                        </strong>

                        <button
                          type="button"
                          class="buyer-cart-remove"
                          data-cart-remove="${escapeCartText(item.id)}"
                        >
                          Remove
                        </button>
                      </div>

                    </div>
                  `
                )
                .join("")}
            </div>

            <div class="buyer-cart-summary">
              <div>
                <span>Subtotal</span>
                <strong>${formatMoney(total)}</strong>
              </div>

              <div>
                <span>Delivery</span>
                <strong>Calculated at checkout</strong>
              </div>

              <div class="buyer-cart-grand-total">
                <span>Total</span>
                <strong>${formatMoney(total)}</strong>
              </div>

              <button
                type="button"
                class="buyer-checkout-btn"
                data-checkout-cart
              >
                Proceed to Checkout
                <span>→</span>
              </button>
            </div>
          `
          : `
            <div class="buyer-cart-empty">
              <div class="buyer-cart-empty-icon">🛍️</div>

              <strong>Cart yako iko tupu</strong>

              <span>
                Chagua bidhaa kwenye Zenodic Market ili zionekane hapa.
              </span>

              <button
                type="button"
                class="buyer-primary-action"
                data-nav="market"
              >
                Shop Market
                <span>→</span>
              </button>
            </div>
          `
      }
    `;
  }

  function renderCheckout() {
    const itemsContainer =
      document.getElementById("checkoutItems");

    const totalElement =
      document.getElementById("checkoutTotal");

    if (!itemsContainer || !totalElement) return;

    const cart = getCart();

    if (!cart.length) {
      itemsContainer.innerHTML = `
        <div class="buyer-cart-empty">
          <div class="buyer-cart-empty-icon">🛍️</div>
          <strong>Cart yako iko tupu</strong>
          <span>Rudi Market uchague bidhaa.</span>
        </div>
      `;

      totalElement.textContent = formatMoney(0);
      return;
    }

    const total = calculateCartTotal(cart);

    itemsContainer.innerHTML = cart
      .map(
        (item) => `
          <div class="buyer-checkout-item">

            <div class="buyer-checkout-item-icon">
              ${escapeCartText(item.icon || "📦")}
            </div>

            <div class="buyer-checkout-item-info">
              <strong>${escapeCartText(item.name)}</strong>
              <span>${escapeCartText(item.category || "Product")}</span>
              <small>
                Qty ${Number(item.quantity || 0)}
              </small>
            </div>

            <strong>
              ${formatMoney(
                Number(item.price || 0) *
                Number(item.quantity || 0)
              )}
            </strong>

          </div>
        `
      )
      .join("");

    totalElement.textContent = formatMoney(total);
  }

  function showCheckout() {
    const dashboard =
      document.getElementById("buyerDashboard");

    const checkout =
      document.getElementById("buyerCheckout");

    if (!checkout) return;

    $$(".page").forEach((item) => {
      item.classList.remove("active");
    });

    if (dashboard) {
      dashboard.classList.add("active");
    }

    if (dashboard) {
      dashboard.classList.add("buyer-subpage-active");
    }

    ["market", "orders", "cart"].forEach((id) => {
      const section = document.getElementById(id);

      if (section) {
        section.style.display = "none";
      }
    });

    checkout.style.display = "block";

    renderCheckout();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function showCart() {
    const checkout =
      document.getElementById("buyerCheckout");

    if (checkout) {
      checkout.style.display = "none";
    }

    const dashboard =
      document.getElementById("buyerDashboard");

    if (dashboard) {
      dashboard.classList.add("buyer-subpage-active");
    }

    const cart =
      document.getElementById("cart");

    if (cart) {
      cart.style.display = "block";
    }

    renderCart();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function addToCart(button) {
    const productId = Number(button.dataset.productId || 0);
    const name = button.dataset.productName;
    const price = Number(
      button.dataset.productPrice || 0
    );
    const category =
      button.dataset.productCategory || "Product";

    if (!productId || !name || !price) {
      alert("Bidhaa hii haijawekewa taarifa kamili.");
      return;
    }

    const id = String(productId);

    const cart = getCart();

    const existing = cart.find(
      (item) => item.id === id
    );

    if (existing) {
      existing.quantity =
        Number(existing.quantity || 0) + 1;
    } else {
      const card =
        button.closest(".product-card");

      const icon =
        card
          ?.querySelector(".product-image")
          ?.textContent
          ?.trim() || "📦";

      cart.push({
        id,
        product_id: productId,
        name,
        price,
        category,
        quantity: 1,
        icon
      });
    }

    saveCart(cart);

    alert(
      state.language === "sw"
        ? `${name} imeongezwa kwenye Cart.`
        : `${name} added to your cart.`
    );
  }

  document.addEventListener("click", async (event) => {

    const productButton =
      event.target.closest("[data-product-action]");

    if (
      productButton &&
      productButton.dataset.productAction === "cart"
    ) {
      event.preventDefault();
      addToCart(productButton);
      return;
    }

    const plusButton =
      event.target.closest("[data-cart-plus]");

    if (plusButton) {
      const id = plusButton.dataset.cartPlus;
      const cart = getCart();

      const item = cart.find(
        (entry) => entry.id === id
      );

      if (item) {
        item.quantity =
          Number(item.quantity || 0) + 1;

        saveCart(cart);
      }

      return;
    }

    const minusButton =
      event.target.closest("[data-cart-minus]");

    if (minusButton) {
      const id = minusButton.dataset.cartMinus;
      const cart = getCart();

      const item = cart.find(
        (entry) => entry.id === id
      );

      if (item) {
        item.quantity =
          Number(item.quantity || 0) - 1;

        if (item.quantity <= 0) {
          const index = cart.indexOf(item);
          cart.splice(index, 1);
        }

        saveCart(cart);
      }

      return;
    }

    const removeButton =
      event.target.closest("[data-cart-remove]");

    if (removeButton) {
      const id = removeButton.dataset.cartRemove;

      const cart = getCart().filter(
        (item) => item.id !== id
      );

      saveCart(cart);
      return;
    }

    const checkoutButton =
      event.target.closest("[data-checkout-cart]");

    if (checkoutButton) {
      event.preventDefault();

      const cart = getCart();

      if (!cart.length) {
        alert("Cart yako iko tupu.");
        return;
      }

      showCheckout();
      return;
    }

    const backToCart =
      event.target.closest('[data-nav="cart"]');

    if (
      backToCart &&
      document.getElementById("buyerCheckout")?.style.display === "block"
    ) {
      event.preventDefault();
      showCart();
      return;
    }

    const placeOrderButton =
      event.target.closest(
        "[data-place-checkout-order]"
      );

    if (placeOrderButton) {
      event.preventDefault();

      const cart = getCart();

      const location =
        document.getElementById(
          "checkoutDeliveryLocation"
        )?.value.trim();

      const paymentMethod =
        document.querySelector(
          'input[name="checkoutPaymentMethod"]:checked'
        )?.value;

      const message =
        document.getElementById(
          "checkoutPaymentMessage"
        );

      if (!cart.length) {
        if (message) {
          message.style.display = "block";
          message.textContent =
            "Cart yako iko tupu.";
        }

        return;
      }

      if (!location) {
        if (message) {
          message.style.display = "block";
          message.textContent =
            "Tafadhali weka Delivery Location.";
        }

        document
          .getElementById(
            "checkoutDeliveryLocation"
          )
          ?.focus();

        return;
      }

      if (message) {
        message.style.display = "block";
        message.textContent = "Inatengeneza order...";
      }

      try {
        const items = cart.map((item) => ({
          product_id: Number(item.product_id || item.id),
          quantity: Number(item.quantity || 1)
        }));

        if (items.some((item) => !Number.isInteger(item.product_id) || item.product_id <= 0)) {
          throw new Error("Cart ina bidhaa yenye ID isiyo sahihi.");
        }

        const response = await fetch(API_BASE + "/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            items,
            delivery_location: location
          })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
            data.error ||
            "Imeshindikana kuunda order."
          );
        }

        saveCart([]);
        renderCart();

        if (message) {
          message.style.display = "block";
          message.textContent =
            `Order ${data.order?.order_number || ""} imeundwa successfully.`;
        }

        alert(
          `Order imeundwa${data.order?.order_number ? `: ${data.order.order_number}` : ""}.`
        );
      } catch (error) {
        console.error("BUYER CHECKOUT ERROR:", error);

        if (message) {
          message.style.display = "block";
          message.textContent =
            error.message || "Imeshindikana kuunda order.";
        }
      }
    }
  });

  loadBuyerMarket();
  renderCart();

  window.refreshBuyerCart = renderCart;
  window.refreshBuyerCheckout = renderCheckout;
}

function getZenodicUserId() {
  if (state.user && state.user.id) {
    return Number(state.user.id);
  }

  const savedUser = localStorage.getItem("zenodic_user");

  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser);

      if (parsed && parsed.id) {
        state.user = parsed;
        return Number(parsed.id);
      }
    } catch (error) {
      console.warn("Saved user parse error:", error);
    }
  }

  return 0;
}


function setupBuyerOverview() {
  const recentList = document.getElementById("buyerRecentOrders");
  if (!recentList) return;

  const savedUser = localStorage.getItem("zenodic_user");

  if (savedUser) {
    try {
      const parsedUser = JSON.parse(savedUser);

      if (parsedUser && parsedUser.id) {
        state.user = parsedUser;
        state.role = parsedUser.role || state.role;
      }
    } catch (error) {
      console.warn("Buyer overview user parse error:", error);
    }
  }

  const buyerId = getZenodicUserId();

  const nameElement = document.getElementById("buyerWelcomeName");

  if (nameElement) {
    nameElement.textContent =
      (state.user && state.user.name) || "Buyer";
  }

  if (!buyerId) {
    recentList.innerHTML = `
      <div class="buyer-empty-state">
        Ingia kwanza ili kuona orders zako.
      </div>
    `;
    return;
  }

  function money(amount, currency = "TZS") {
    return new Intl.NumberFormat("en-TZ", {
      style: "currency",
      currency: currency || "TZS",
      minimumFractionDigits: 2
    }).format(Number(amount || 0));
  }

  function orderStatus(status) {
    const value = String(status || "pending").toLowerCase();

    if (value === "completed") return "Completed";
    if (value === "cancelled") return "Cancelled";
    if (value === "processing") return "Processing";
    if (value === "confirmed") return "Confirmed";

    return "Pending";
  }

  async function loadOverview() {
    try {
      const response = await fetch(
        `/api/orders?buyer_id=${encodeURIComponent(buyerId)}`,
        {
          credentials: "include"
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load buyer orders."
        );
      }

      const orders = Array.isArray(data.orders)
        ? data.orders
        : Array.isArray(data)
        ? data
        : [];

      const totalOrders = orders.length;

      const pendingOrders = orders.filter((order) => {
        const status = String(order.status || "").toLowerCase();

        return !["completed", "cancelled"].includes(status);
      }).length;

      const paidOrders = orders.filter((order) => {
        return String(order.payment_status || "").toLowerCase() === "paid";
      }).length;

      const totalSpent = orders
        .filter((order) => {
          return String(order.payment_status || "").toLowerCase() === "paid";
        })
        .reduce((sum, order) => {
          return sum + Number(order.total_amount || 0);
        }, 0);

      const totalEl = document.getElementById("buyerTotalOrders");
      const pendingEl = document.getElementById("buyerPendingOrders");
      const paidEl = document.getElementById("buyerPaidOrders");
      const spentEl = document.getElementById("buyerTotalSpent");

      if (totalEl) {
        totalEl.textContent = totalOrders;
      }

      if (pendingEl) {
        pendingEl.textContent = pendingOrders;
      }

      if (paidEl) {
        paidEl.textContent = paidOrders;
      }

      const currency = orders[0]?.currency || "TZS";

      if (spentEl) {
        spentEl.textContent = money(totalSpent, currency);
      }

      const recentOrders = [...orders]
        .sort((a, b) => {
          return (
            new Date(b.created_at || 0) -
            new Date(a.created_at || 0)
          );
        })
        .slice(0, 5);

      if (!recentOrders.length) {
        recentList.innerHTML = `
          <div class="buyer-empty-state">
            Huna orders bado.
          </div>
        `;
        return;
      }

      recentList.innerHTML = recentOrders
        .map((order) => {
          const payment = String(
            order.payment_status || "unpaid"
          ).toLowerCase();

          return `
            <div class="buyer-recent-order">
              <div class="buyer-recent-order-main">
                <strong>
                  ${escapeHtml(
                    order.order_number ||
                    `Order #${order.id}`
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    order.seller_name || "Seller"
                  )}
                </small>
              </div>

              <div class="buyer-recent-order-side">
                <strong>
                  ${money(
                    order.total_amount,
                    order.currency || "TZS"
                  )}
                </strong>

                <span class="buyer-order-status">
                  ${
                    payment === "paid"
                      ? "Paid"
                      : orderStatus(order.status)
                  }
                </span>
              </div>
            </div>
          `;
        })
        .join("");

    } catch (error) {
      console.error(
        "Buyer overview error:",
        error
      );

      recentList.innerHTML = `
        <div class="buyer-empty-state">
          Imeshindikana kupakia orders zako.
        </div>
      `;
    }
  }

  loadOverview();

  window.refreshBuyerOverview = loadOverview;
}

function setupBuyerOrders() {
  const list = document.getElementById("buyerOrdersList");
  const messageBox = document.getElementById("buyerOrdersMessage");
  const refreshButton = document.getElementById("refreshBuyerOrdersBtn");

  if (!list) return;

  let allOrders = [];

  function getBuyerId() {
    const savedUser = localStorage.getItem("zenodic_user");

    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);

        if (parsed && parsed.id) {
          state.user = parsed;
          state.role = parsed.role || state.role;
          return Number(parsed.id);
        }
      } catch (error) {
        console.warn("Saved buyer user parse error:", error);
      }
    }

    if (state.user && state.user.id) {
      return Number(state.user.id);
    }

    return 0;
  }

  function formatMoney(amount, currency = "TZS") {
    const value = Number(amount || 0);

    return new Intl.NumberFormat("en-TZ", {
      style: "currency",
      currency,
      minimumFractionDigits: 2
    }).format(value);
  }

  function formatDate(dateValue) {
    if (!dateValue) return "—";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleString("en-TZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function normalizeStatus(value) {
    return String(value || "pending").trim().toLowerCase();
  }

  function statusLabel(status) {
    const value = normalizeStatus(status);

    const labels = {
      pending: "Pending",
      processing: "Processing",
      confirmed: "Confirmed",
      completed: "Completed",
      cancelled: "Cancelled",
      paid: "Paid",
      unpaid: "Unpaid",
      failed: "Failed",
      refunded: "Refunded"
    };

    return labels[value] || value.charAt(0).toUpperCase() + value.slice(1);
  }

  function statusClass(status) {
    const value = normalizeStatus(status);

    if (["paid", "completed", "confirmed"].includes(value)) {
      return "buyer-status-success";
    }

    if (["failed", "cancelled", "refunded"].includes(value)) {
      return "buyer-status-danger";
    }

    if (["processing"].includes(value)) {
      return "buyer-status-info";
    }

    return "buyer-status-warning";
  }

  function showMessage(message, error = false) {
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.style.display = "block";
    messageBox.className =
      error
        ? "buyer-orders-message buyer-orders-message-error"
        : "buyer-orders-message";
  }

  function hideMessage() {
    if (messageBox) {
      messageBox.style.display = "none";
    }
  }

  function createOrdersToolbar() {
    if (document.getElementById("buyerOrdersToolbar")) return;

    const toolbar = document.createElement("div");

    toolbar.id = "buyerOrdersToolbar";
    toolbar.className = "buyer-orders-toolbar";

    toolbar.innerHTML = `
      <div class="buyer-orders-search-wrap">
        <span class="buyer-orders-search-icon">⌕</span>
        <input
          type="search"
          id="buyerOrdersSearch"
          class="buyer-orders-search"
          placeholder="Search order number or seller..."
          autocomplete="off"
        />
      </div>

      <div class="buyer-orders-filter-wrap">
        <label for="buyerOrdersFilter">Filter</label>
        <select id="buyerOrdersFilter" class="buyer-orders-filter">
          <option value="all">All Orders</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    `;

    list.parentNode.insertBefore(toolbar, list);

    document
      .getElementById("buyerOrdersSearch")
      ?.addEventListener("input", applyFilters);

    document
      .getElementById("buyerOrdersFilter")
      ?.addEventListener("change", applyFilters);
  }

  function renderEmpty(message = "Huna orders zinazolingana na search yako.") {
    list.innerHTML = `
      <div class="buyer-orders-empty">
        <div class="buyer-orders-empty-icon">📦</div>
        <strong>${escapeHtml(message)}</strong>
        <span>Orders zako zitaonekana hapa baada ya kufanya manunuzi.</span>
      </div>
    `;
  }

  function renderOrders(orders) {
    if (!list) return;
    if (!orders.length) {
      renderEmpty();
      return;
    }

    list.innerHTML = orders
      .map((order) => {
        const paymentStatus = normalizeStatus(order.payment_status);
        const orderStatus = normalizeStatus(order.status);

        const canPay =
          paymentStatus !== "paid" &&
          !["cancelled", "completed"].includes(orderStatus);

        const canCancel =
          orderStatus === "pending" &&
          paymentStatus === "unpaid";

        const orderNumber =
          order.order_number || `Order #${order.id}`;

        const sellerName =
          order.seller_name || "Seller";

        return `
          <article class="buyer-order-card">

            <div class="buyer-order-card-top">

              <div class="buyer-order-identity">
                <div class="buyer-order-icon">📦</div>

                <div>
                  <span class="buyer-order-label">ORDER</span>

                  <strong class="buyer-order-number">
                    ${escapeHtml(orderNumber)}
                  </strong>

                  <span class="buyer-order-seller">
                    ${escapeHtml(sellerName)}
                  </span>
                </div>
              </div>

              <div class="buyer-order-amount">
                <span>Total amount</span>

                <strong>
                  ${formatMoney(
                    order.total_amount,
                    order.currency || "TZS"
                  )}
                </strong>
              </div>

            </div>

            <div class="buyer-order-divider"></div>

            <div class="buyer-order-meta">

              <div>
                <span>Date</span>
                <strong>
                  ${escapeHtml(formatDate(order.created_at))}
                </strong>
              </div>

              <div>
                <span>Order status</span>
                <strong class="buyer-status ${statusClass(orderStatus)}">
                  ${escapeHtml(statusLabel(orderStatus))}
                </strong>
              </div>

              <div>
                <span>Payment</span>
                <strong class="buyer-status ${statusClass(paymentStatus)}">
                  ${escapeHtml(statusLabel(paymentStatus))}
                </strong>
              </div>

            </div>

            <div class="buyer-order-actions">

              <button
                type="button"
                class="buyer-order-details-btn"
                data-order-details="${order.id}"
              >
                View Details
              </button>

              ${
                canPay
                  ? `
                    <button
                      type="button"
                      class="buyer-order-pay-btn"
                      data-order-payment="${order.id}"
                    >
                      Pay Now
                      <span>→</span>
                    </button>
                  `
                  : ""
              }
              ${
                canCancel
                  ? `
                    <button
                      type="button"
                      class="buyer-order-cancel-btn"
                      data-order-cancel="${order.id}"
                    >
                      Cancel Order
                    </button>
                  `
                  : ""
              }


            </div>

          </article>
        `;
      })
      .join("");
  }

  function applyFilters() {
    const search =
      String(
        document.getElementById("buyerOrdersSearch")?.value || ""
      )
        .trim()
        .toLowerCase();

    const filter =
      document.getElementById("buyerOrdersFilter")?.value || "all";

    const filtered = allOrders.filter((order) => {
      const orderNumber = String(
        order.order_number || order.id || ""
      ).toLowerCase();

      const sellerName = String(
        order.seller_name || "seller"
      ).toLowerCase();

      const orderStatus = normalizeStatus(order.status);
      const paymentStatus = normalizeStatus(order.payment_status);

      const matchesSearch =
        !search ||
        orderNumber.includes(search) ||
        sellerName.includes(search);

      let matchesFilter = true;

      if (filter === "paid") {
        matchesFilter = paymentStatus === "paid";
      } else if (filter === "unpaid") {
        matchesFilter = paymentStatus === "unpaid";
      } else if (filter === "pending") {
        matchesFilter = orderStatus === "pending";
      } else if (filter === "completed") {
        matchesFilter = orderStatus === "completed";
      } else if (filter === "cancelled") {
        matchesFilter = orderStatus === "cancelled";
      }

      return matchesSearch && matchesFilter;
    });

    renderOrders(filtered);
  }

  function showLoading() {
    list.innerHTML = `
      <div class="buyer-orders-loading">
        <div class="buyer-orders-loading-icon">↻</div>
        <strong>Loading orders...</strong>
        <span>Tafadhali subiri kidogo.</span>
      </div>
    `;
  }

  async function loadOrders() {
    const buyerId = getBuyerId();

    if (!buyerId) {
      renderEmpty("Ingia kwanza ili kuona orders zako.");
      return;
    }

    showLoading();
    hideMessage();

    try {
      const response = await fetch(
        `/api/orders?buyer_id=${encodeURIComponent(buyerId)}`,
        {
          credentials: "include"
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "Failed to load buyer orders."
        );
      }

      allOrders = Array.isArray(data.orders)
        ? data.orders
        : Array.isArray(data)
        ? data
        : [];

      createOrdersToolbar();
      applyFilters();

    } catch (error) {
      console.error("Buyer orders error:", error);

      showMessage(
        error.message || "Imeshindikana kupakia orders zako.",
        true
      );

      renderEmpty("Imeshindikana kupakia orders zako.");
    }
  }

  createOrdersToolbar();

  refreshButton?.addEventListener("click", loadOrders);

  list.addEventListener("click", async (event) => {
    const detailsButton = event.target.closest("[data-order-details]");
    const paymentButton = event.target.closest("[data-order-payment]");
    const cancelButton = event.target.closest("[data-order-cancel]");

    if (!detailsButton && !paymentButton && !cancelButton) return;

    event.preventDefault();

    const orderId =
      detailsButton?.dataset.orderDetails ||
      paymentButton?.dataset.orderPayment ||
      cancelButton?.dataset.orderCancel;

    if (cancelButton) {
      const confirmed = window.confirm(
        "Una uhakika unataka ku-cancel order hii? Reserved stock itarejeshwa."
      );

      if (!confirmed) return;

      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderId)}/cancel`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json"
            }
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Imeshindikana ku-cancel order."
          );
        }

        showMessage(
          data.message || "Order imecancelwa.",
          false
        );

        await loadOrders();
      } catch (error) {
        console.error("Buyer order cancellation error:", error);
        showMessage(
          error.message || "Imeshindikana ku-cancel order.",
          true
        );
      }

      return;
    }

    if (!orderId) return;

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}`,
        { credentials: "include" }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.order) {
        throw new Error(
          data.message || "Order haikupatikana."
        );
      }

      if (detailsButton) {
        if (typeof window.openZenodicOrderDetails === "function") {
          window.openZenodicOrderDetails(data.order.id);
        }
        return;
      }

      if (paymentButton) {
        if (typeof window.showBuyerPaymentModal === "function") {
          window.showBuyerPaymentModal(data.order);
        }
      }
    } catch (error) {
      console.error("Buyer order action error:", error);
      showMessage(
        error.message || "Imeshindikana kufungua order.",
        true
      );
    }
  });

  loadOrders();

  window.setupBuyerOrdersRefresh = loadOrders;
}


function setupWholesaleOrders() {
    const list = $("#ordersLiveList");
    const messageBox = $("#ordersLiveMessage");
    const refreshButton = $("#refreshOrdersBtn");

    if (!list && !modernList) return;

    function getUserId() {
      if (state.user && state.user.id) {
        return Number(state.user.id);
      }

      const savedUser = localStorage.getItem("zenodic_user");

      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);

          if (parsed && parsed.id) {
            state.user = parsed;
            return Number(parsed.id);
          }
        } catch (error) {
          console.warn("Saved user parse error:", error);
        }
      }

      return 0;
    }

    function showMessage(text, isError = false) {
      if (!messageBox) return;

      messageBox.textContent = text;
      messageBox.style.display = "block";
      messageBox.style.padding = "10px 14px";
      messageBox.style.borderRadius = "8px";
      messageBox.style.border = "1px solid";

      if (isError) {
        messageBox.style.borderColor = "#d33";
      } else {
        messageBox.style.borderColor = "#2a8";
      }
    }

    function money(amount, currency = "TZS") {
      const value = Number(amount || 0);

      return `${value.toLocaleString()} ${currency}`;
    }

    function renderOrders(orders) {
    if (!list) return;
      if (!orders.length) {
        list.innerHTML = `
          <div class="wholesale-empty-state">
            Hakuna orders kwa sasa.
          </div>
        `;
        return;
      }

      list.innerHTML = orders.map((order) => `
        <div
          class="wholesale-order-card"
          data-order-id="${order.id}"
          style="border:1px solid rgba(0,0,0,.1);border-radius:12px;padding:18px;margin-bottom:14px;"
        >
          <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">

            <div>
              <span class="panel-label">ORDER</span>
              <h4 style="margin:6px 0;">
                ${order.order_number || `#${order.id}`}
              </h4>

              <p style="margin:0;">
                RFQ #${order.rfq_id ?? "-"}
              </p>
            </div>

            <div>
              <strong>
                ${money(order.total_amount, order.currency)}
              </strong>
            </div>

          </div>

          <div
            style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:16px;"
          >
            <div>
              <small>Status</small>
              <div><strong>${order.status || "-"}</strong></div>
            </div>

            <div>
              <small>Payment</small>
              <div><strong>${order.payment_status || "-"}</strong></div>
            </div>

            <div>
              <small>Delivery</small>
              <div><strong>${order.delivery_location || "-"}</strong></div>
            </div>

            <div>
              <small>Expected</small>
              <div><strong>${order.expected_delivery || "-"}</strong></div>
            </div>
          </div>

        </div>
      `).join("");
    }

    async function loadOrders() {
      list.innerHTML = `
        <div class="wholesale-empty-state">
          Loading orders...
        </div>
      `;

      try {
        const response = await fetch(
          "/api/orders", { credentials: "include" }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Imeshindikana kupata orders."
          );
        }

        renderOrders(Array.isArray(data.orders) ? data.orders : []);

        if (messageBox) {
          messageBox.style.display = "none";
        }

      } catch (error) {
        console.error("Load wholesale orders error:", error);

        list.innerHTML = `
          <div class="wholesale-empty-state">
            Imeshindikana kupakia orders.
          </div>
        `;

        showMessage(
          error.message || "Imeshindikana kupata orders.",
          true
        );
      }
    }

    if (refreshButton) {
      refreshButton.addEventListener("click", loadOrders);
    }

    document.addEventListener("click", (event) => {
      const button = event.target.closest(
        '[data-wholesale-action="orders"]'
      );

      if (!button) return;

      loadOrders();
    });

  }

  /* ---------- ORDER DETAILS + PAYMENT ---------- */

  function setupWholesaleRFQ() {
    const form = $("#rfqForm");
    const createPanel = $("#rfqCreatePanel");
    const list = $("#rfqLiveList");
    const messageBox = $("#rfqLiveMessage");

    if (!form || !createPanel || !list) return;

    function getUserId() {
      return state.user?.id || null;
    }

    function showMessage(text, success = true) {
      if (!messageBox) return;

      messageBox.textContent = text;
      messageBox.style.display = "block";
      messageBox.style.padding = "12px";
      messageBox.style.borderRadius = "10px";
      messageBox.style.background = success ? "#ecfdf5" : "#fef2f2";
      messageBox.style.color = success ? "#047857" : "#b91c1c";
    }

    async function loadRFQs() {
      const userId = getUserId();

      if (!userId) {
        list.innerHTML = `
          <div class="wholesale-panel">
            <p>Ingia kwenye account yako kuona RFQs.</p>
          </div>
        `;
        return;
      }

      list.innerHTML = `
        <div class="wholesale-panel">
          <p>Loading RFQs...</p>
        </div>
      `;

      try {
        const response = await fetch(
          "/api/rfqs"
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Imeshindikana kupata RFQs.");
        }

        const rfqs = Array.isArray(data.rfqs) ? data.rfqs : [];

        if (!rfqs.length) {
          list.innerHTML = `
            <div class="wholesale-panel">
              <strong>Hakuna RFQ bado.</strong>
              <p style="margin-top:6px;">
                Bonyeza "Create RFQ" kuanza procurement.
              </p>
            </div>
          `;
          return;
        }

        list.innerHTML = rfqs.map((rfq) => `
          <div class="wholesale-panel" style="margin-bottom:12px;">
            <div class="panel-header">
              <div>
                <span class="panel-label">
                  RFQ #${rfq.id}
                </span>
                <h3>${escapeHtml(rfq.title)}</h3>
              </div>

              <span class="rfq-status ${escapeHtml(rfq.status || "open")}">
                ${escapeHtml((rfq.status || "open").toUpperCase())}
              </span>
            </div>

            <p>${escapeHtml(rfq.description || "")}</p>

            <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:12px;">
              <span>
                <strong>${escapeHtml(String(rfq.quantity))}</strong>
                ${escapeHtml(rfq.unit || "")}
              </span>

              <span>
                ${escapeHtml(rfq.currency || "TZS")}
              </span>

              <span>
                ${escapeHtml(rfq.created_at || "")}
              </span>
            </div>
          </div>
        `).join("");

      } catch (error) {
        console.error("RFQ load failed:", error);

        list.innerHTML = `
          <div class="wholesale-panel">
            <p>Imeshindikana kupakia RFQs.</p>
          </div>
        `;
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const userId = getUserId();

      if (!userId) {
        showMessage("Tafadhali login kwanza.", false);
        return;
      }

      const submitButton = $("#rfqSubmitButton");

      const payload = {
        user_id: userId,
        title: $("#rfqTitle")?.value.trim(),
        description: $("#rfqDescription")?.value.trim(),
        quantity: Number($("#rfqQuantity")?.value),
        unit: $("#rfqUnit")?.value.trim()
      };

      if (
        !payload.title ||
        !payload.description ||
        !payload.quantity ||
        !payload.unit
      ) {
        showMessage("Jaza taarifa zote za RFQ.", false);
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Inatuma...";
      }

      try {
        const response = await fetch(API_BASE + "/api/rfqs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "RFQ imeshindikana kutumwa."
          );
        }

        form.reset();
        createPanel.style.display = "none";

        showMessage("RFQ imeundwa vizuri.", true);

        await loadRFQs();

      } catch (error) {
        console.error("RFQ creation failed:", error);
        showMessage(
          error.message || "RFQ imeshindikana kutumwa.",
          false
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Submit RFQ";
        }
      }
    });

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-wholesale-action]");

      if (!button) return;

      const action = button.dataset.wholesaleAction;

      if (action === "create-rfq") {
        createPanel.style.display = "block";
        messageBox.style.display = "none";
        $("#rfqTitle")?.focus();
      }

      if (action === "cancel-rfq") {
        createPanel.style.display = "none";
        form.reset();
      }

      if (action === "rfq") {
        loadRFQs();
      }
    });

    loadRFQs();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }



  
/* ---------- WHOLESALE PAYMENTS ---------- */
async function loadWholesalePayments() {
  const section = document.querySelector("#wholesalePaymentsSection");
  if (!section) return;

  const loading = document.querySelector("#wholesalePaymentsLoading");
  const empty = document.querySelector("#wholesalePaymentsEmpty");
  const tableWrap = document.querySelector("#wholesalePaymentsTableWrap");
  const tableBody = document.querySelector("#wholesalePaymentsTableBody");

  try {
    if (loading) loading.style.display = "";
    if (empty) empty.style.display = "none";
    if (tableWrap) tableWrap.style.display = "none";

    const response = await fetch(API_BASE + "/api/payments/wholesale", { credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        data.error ||
        "Imeshindikana kupakia Wholesale Payments."
      );
    }

    const summary = data.summary || {};
    const transactions = Array.isArray(data.transactions)
      ? data.transactions
      : [];

    const currency = data.currency || transactions[0]?.currency || "TZS";

    const money = (amount) =>
      new Intl.NumberFormat("en-TZ", {
        style: "currency",
        currency,
        maximumFractionDigits: 0
      }).format(Number(amount || 0));

    const received = document.querySelector("#wholesalePaymentsReceived");
    const pending = document.querySelector("#wholesalePaymentsPending");
    const refunded = document.querySelector("#wholesalePaymentsRefunded");
    const count = document.querySelector("#wholesalePaymentsCount");
    const activityCount = document.querySelector("#wholesalePaymentsActivityCount");

    if (received) received.textContent = money(summary.total_paid);
    if (pending) pending.textContent = money(summary.total_pending);
    if (refunded) refunded.textContent = money(summary.total_refunded);
    if (count) count.textContent = Number(summary.transaction_count || 0);
    if (activityCount) {
      activityCount.textContent = `${transactions.length} recent`;
    }

    if (loading) loading.style.display = "none";

    if (!transactions.length) {
      if (empty) empty.style.display = "";
      return;
    }

    if (tableBody) {
      tableBody.innerHTML = transactions.map((tx) => {
        const status = String(tx.status || "pending").toLowerCase();
        const statusClass = `is-${status}`;

        const dateValue = tx.paid_at || tx.created_at;
        const date = dateValue
          ? new Date(dateValue).toLocaleDateString("en-TZ", {
              day: "2-digit",
              month: "short",
              year: "numeric"
            })
          : "—";

        return `
          <tr>
            <td>
              <div class="seller-payment-order">
                ${tx.order_number || tx.order_id || "—"}
              </div>
              <div class="seller-payment-ref">
                ${tx.payment_reference || "No reference"}
              </div>
            </td>
            <td>${tx.buyer_name || "—"}</td>
            <td>${tx.payment_method || "—"}</td>
            <td>
              <span class="seller-payment-gross">
                ${money(tx.amount)}
              </span>
            </td>
            <td>
              <span class="seller-payment-status ${statusClass}">
                ${status}
              </span>
            </td>
            <td>${date}</td>
          </tr>
        `;
      }).join("");
    }

    if (tableWrap) tableWrap.style.display = "";

  } catch (error) {
    console.error("Wholesale Payments error:", error);

    if (loading) loading.style.display = "none";
    if (empty) {
      empty.style.display = "";
      empty.innerHTML = `
        <strong>Unable to load payments</strong>
        <p>${error.message || "Please try again."}</p>
      `;
    }
  }
}

/* ---------- WHOLESALE SIDEBAR NAVIGATION ---------- */
  async function loadWholesaleOverview() {
  try {
    const response = await fetch(API_BASE + "/api/wholesale/overview");
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || result.error || "Imeshindikana kupakia Wholesale Overview."
      );
    }

    const data = result.data || {};

    const activeOrders = document.getElementById("wholesaleActiveOrders");
    const openRfqs = document.getElementById("wholesaleOpenRfqs");
    const production = document.getElementById("wholesaleProductionCount");
    const stockAlerts = document.getElementById("wholesaleStockAlerts");

    if (activeOrders) {
      activeOrders.textContent = Number(data.active_orders || 0);
    }

    if (openRfqs) {
      openRfqs.textContent = Number(data.open_rfqs || 0);
    }

    if (production) {
      production.textContent = Number(data.production_in_progress || 0);
    }

    if (stockAlerts) {
      stockAlerts.textContent = Number(data.stock_alerts || 0);
    }
  } catch (error) {
    console.error("Wholesale Overview error:", error);
  }
}



async function updateWholesaleProductionProgress(productionId, producedQuantity, messageBox, button) {
  try {
    if (messageBox) {
      messageBox.style.display = "none";
      messageBox.textContent = "";
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Updating...";
    }

    const response = await fetch(
      `/api/production/${productionId}/progress`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          produced_quantity: producedQuantity
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        data.error ||
        "Imeshindikana ku-update production progress."
      );
    }

    if (messageBox) {
      messageBox.style.display = "block";
      messageBox.textContent =
        data.message || "Production progress imeupdated.";
    }

    await loadWholesaleProduction();

    if (typeof loadWholesaleOverview === "function") {
      await loadWholesaleOverview();
    }
  } catch (error) {
    console.error("PRODUCTION_PROGRESS_UPDATE ERROR:", error);

    if (messageBox) {
      messageBox.style.display = "block";
      messageBox.textContent =
        error.message || "Imeshindikana ku-update progress.";
    }

    if (button) {
      button.disabled = false;
      button.textContent = "Update Progress";
    }
  }
}

function setupWholesaleProductionProgress() {
  if (window.__wholesaleProductionProgressReady) return;

  window.__wholesaleProductionProgressReady = true;

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".production-progress-btn");

    if (!button) return;

    const debugCard = button.closest("[data-production-id]");
    const debugMessage = debugCard?.querySelector(".production-progress-message");

    if (debugMessage) {
      debugMessage.style.display = "block";
      debugMessage.textContent = "Button imefikiwa. Production ID: " + button.dataset.productionId;
    }

    console.log("WHOLESALE PROGRESS BUTTON CLICKED", button.dataset.productionId);

    const productionId = Number(button.dataset.productionId);
    const card = button.closest("[data-production-id]");
    const input = card?.querySelector(".production-progress-input");
    const messageBox = card?.querySelector(".production-progress-message");
    const producedQuantity = Number(input?.value);

    if (!Number.isInteger(productionId) || productionId <= 0) {
      if (messageBox) {
        messageBox.style.display = "block";
        messageBox.textContent = "Production ID si sahihi.";
      }
      return;
    }

    if (!Number.isFinite(producedQuantity) || producedQuantity < 0) {
      if (messageBox) {
        messageBox.style.display = "block";
        messageBox.textContent = "Produced quantity si sahihi.";
      }
      return;
    }

    updateWholesaleProductionProgress(
      productionId,
      producedQuantity,
      messageBox,
      button
    );
  });
}


function setupWholesaleProductionCreate() {
  const form = document.getElementById("productionCreateForm");
  const messageBox = document.getElementById("productionCreateMessage");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');

    const productName =
      document.getElementById("productionProductName")?.value.trim();

    const plannedQuantity =
      Number(document.getElementById("productionPlannedQuantity")?.value);

    const unit =
      document.getElementById("productionUnit")?.value.trim() || "pcs";

    const orderId =
      document.getElementById("productionOrderId")?.value.trim();

    const startDate =
      document.getElementById("productionStartDate")?.value || null;

    const expectedCompletion =
      document.getElementById("productionExpectedCompletion")?.value || null;

    if (!productName || !Number.isFinite(plannedQuantity) || plannedQuantity <= 0) {
      if (messageBox) {
        messageBox.style.display = "block";
        messageBox.textContent = "Jaza product name na planned quantity sahihi.";
      }
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Creating...";
    }

    if (messageBox) {
      messageBox.style.display = "none";
      messageBox.textContent = "";
    }

    try {
      const response = await fetch(API_BASE + "/api/production", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          product_name: productName,
          planned_quantity: plannedQuantity,
          unit,
          order_id: orderId || null,
          start_date: startDate,
          expected_completion: expectedCompletion
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          data.error ||
          "Imeshindikana kuunda production order."
        );
      }

      form.reset();

      const unitInput = document.getElementById("productionUnit");
      if (unitInput) {
        unitInput.value = "pcs";
      }

      if (messageBox) {
        messageBox.style.display = "block";
        messageBox.textContent =
          data.message || "Production order imeundwa.";
      }

      await loadWholesaleProduction();

      if (typeof loadWholesaleOverview === "function") {
        await loadWholesaleOverview();
      }
    } catch (error) {
      console.error("Create production error:", error);

      if (messageBox) {
        messageBox.style.display = "block";
        messageBox.textContent =
          error.message || "Imeshindikana kuunda production order.";
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Create Production";
      }
    }
  });
}


async function loadWholesaleProduction() {
  const list = document.getElementById("wholesaleProductionList");
  if (!list) return;

  list.innerHTML = `
    <div class="wholesale-empty-state">
      Loading production...
    </div>
  `;

  try {
    const response = await fetch(API_BASE + "/api/production", {
      credentials: "include"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || data.error || "Imeshindikana kupata production orders."
      );
    }

    const productionOrders = Array.isArray(data.productionOrders)
      ? data.productionOrders
      : [];

    if (!productionOrders.length) {
      list.innerHTML = `
        <div class="wholesale-empty-state">
          Hakuna production orders kwa sasa.
        </div>
      `;
      return;
    }

    list.innerHTML = productionOrders.map((item) => {
      const planned = Number(item.planned_quantity || 0);
      const produced = Number(item.produced_quantity || 0);
      const progress = planned > 0
        ? Math.min(100, Math.max(0, (produced / planned) * 100))
        : 0;

      const progressLabel = `${Math.round(progress)}%`;
      const orderLabel = item.order_number
        ? `Order #${item.order_number}`
        : `Production #${item.production_number}`;

      const expected = item.expected_completion
        ? `Expected: ${item.expected_completion}`
        : "Expected date haijawekwa";

      return `
        <div class="production-item" data-production-id="${item.id}">
          <div class="production-top">
            <strong>${orderLabel}</strong>
            <span>${progressLabel}</span>
          </div>

          <div class="progress-track">
            <div
              class="progress-fill"
              style="width:${progress}%;">
            </div>
          </div>

          <small>
            ${item.product_name} ·
            ${produced}/${planned} ${item.unit || "pcs"} ·
            ${item.status || "planned"} ·
            ${expected}
          </small>

          <div style="display:flex;gap:8px;align-items:center;margin-top:12px;">
            <input
              type="number"
              class="production-progress-input"
              min="0"
              max="${planned}"
              step="0.01"
              value="${produced}"
              style="max-width:140px;"
            >

            <button
              type="button"
              class="secondary-btn production-progress-btn"
              data-production-id="${item.id}"
              onclick="console.log('DIRECT PRODUCTION CLICK', this.dataset.productionId); this.closest('[data-production-id]').querySelector('.production-progress-message').style.display='block'; this.closest('[data-production-id]').querySelector('.production-progress-message').textContent='DIRECT CLICK: ' + this.dataset.productionId;">
              Update Progress
            </button>
          </div>

          <div
            class="production-progress-message"
            style="display:none;margin-top:8px;">
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".production-progress-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const productionId = Number(button.dataset.productionId);
        const card = button.closest("[data-production-id]");
        const input = card?.querySelector(".production-progress-input");
        const messageBox = card?.querySelector(".production-progress-message");
        const producedQuantity = Number(input?.value);

        if (!Number.isInteger(productionId) || productionId <= 0) {
          if (messageBox) {
            messageBox.style.display = "block";
            messageBox.textContent = "Production ID si sahihi.";
          }
          return;
        }

        if (!Number.isFinite(producedQuantity) || producedQuantity < 0) {
          if (messageBox) {
            messageBox.style.display = "block";
            messageBox.textContent = "Produced quantity si sahihi.";
          }
          return;
        }

        updateWholesaleProductionProgress(
          productionId,
          producedQuantity,
          messageBox,
          button
        );
      });
    });
  } catch (error) {
    console.error("Wholesale Production error:", error);

    list.innerHTML = `
      <div class="wholesale-empty-state">
        Imeshindikana kupakia production.
        <br>
        <small>${error.message || ""}</small>
      </div>
    `;
  }
}

function setupWholesaleSidebarNavigation() {
    const dashboard = document.getElementById("wholesaleDashboard");
    if (!dashboard) return;

    setupWholesaleProductionProgress();

    const navItems = dashboard.querySelectorAll("[data-wholesale-nav]");

    const views = {
      overview: [
        "wholesaleOverviewSection",
        "wholesaleQuickActionsSection"
      ],
      orders: [
        "wholesaleOrdersSection"
      ],
      procurement: [
        "wholesaleRfqSection"
      ],
      production: [
        "wholesaleProductionSection"
      ],
      inventory: [
        "wholesaleInventorySection"
      ],
      payments: [
        "wholesalePaymentsSection"
      ],
      analytics: [
        "wholesaleAnalyticsSection"
      ],
      reports: [
        "wholesaleReportsSection"
      ],
      intelligence: [
        "wholesaleIntelligenceSection",
        "wholesaleIntelligenceCard"
      ]
    };

    // Create Wholesale workspaces that are not yet backed by dedicated APIs.
    const workspaceConfig = {
      wholesalePaymentsSection: {
        label: "PAYMENTS",
        title: "Wholesale Payments",
        text: "Payment tracking, settlement status na B2B transaction management."
      },
      wholesaleAnalyticsSection: {
        label: "ANALYTICS",
        title: "Wholesale Analytics",
        text: "Sales trends, order performance, margins na business performance."
      },
      wholesaleReportsSection: {
        label: "REPORTS",
        title: "Wholesale Reports",
        text: "Generate na review reports za orders, procurement, inventory na payments."
      },
      wholesaleIntelligenceSection: {
        label: "INTELLIGENCE",
        title: "ZENODIC Intelligence",
        text: "Demand forecasting, smart pricing, stock prediction na production planning."
      }
    };

    Object.entries(workspaceConfig).forEach(([id, config]) => {
      if (document.getElementById(id)) return;

      const section = document.createElement("section");
      section.id = id;
      section.className = "wholesale-section wholesale-workspace-panel";
      section.style.display = "none";
      section.innerHTML = `
        <div class="section-heading">
          <div>
            <span class="panel-label">${config.label}</span>
            <h3>${config.title}</h3>
            <p>${config.text}</p>
          </div>
        </div>
        <div class="wholesale-panel">
          <div class="wholesale-empty-state">
            Workspace tayari imeunganishwa. Data/API integration itafuata.
          </div>
        </div>
      `;

      dashboard.querySelector(".wholesale-main .wholesale-dashboard")?.appendChild(section);
    });

    function activateNav(name) {
      navItems.forEach((item) => {
        item.classList.toggle(
          "active",
          item.dataset.wholesaleNav === name
        );
      });
    }

    function showView(name) {
      const targetIds = views[name];

      if (!targetIds) {
        activateNav(name);
        return;
      }

      // Hide every Wholesale workspace section first.
      dashboard
        .querySelectorAll(
          ".wholesale-dashboard .wholesale-section, .wholesale-dashboard .wholesale-two-column"
        )
        .forEach((section) => {
          section.style.display = "none";
        });

      // Then show only the sections belonging to the selected view.
      targetIds.forEach((id) => {
        const section = document.getElementById(id);
        if (!section) return;

        section.style.display = "";
      });

      activateNav(name);

      if (name === "overview" && typeof loadWholesaleOverview === "function") {
        loadWholesaleOverview();
      }

      if (name === "production" && typeof loadWholesaleProduction === "function") {
      loadWholesaleProduction();
    }

      if (name === "payments" && typeof loadWholesalePayments === "function") {
        loadWholesalePayments();
      }

      if (name === "inventory" && typeof loadWholesaleInventory === "function") {
        loadWholesaleInventory();
      }

      dashboard.querySelector(".dashboard-box")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        showView(item.dataset.wholesaleNav);
      });
    });

    showView("overview");

    // Wholesale mobile menu
    const mobileMenuButtons = dashboard.querySelectorAll(".wholesale-menu-btn");
    const sidebar = dashboard.querySelector(".wholesale-sidebar");
    const overlay = dashboard.querySelector("#wholesaleSidebarOverlay");

    function setWholesaleMobileMenu(open) {
      if (!sidebar || !overlay) return;

      sidebar.classList.toggle("mobile-open", open);
      overlay.classList.toggle("active", open);
      overlay.setAttribute("aria-hidden", open ? "false" : "true");

      mobileMenuButtons.forEach((button) => {
        button.setAttribute("aria-expanded", open ? "true" : "false");
        button.setAttribute(
          "aria-label",
          open ? "Close wholesale menu" : "Open wholesale menu"
        );
      });
    }

    mobileMenuButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const isOpen = sidebar.classList.contains("mobile-open");
        setWholesaleMobileMenu(!isOpen);
      });
    });

    overlay?.addEventListener("click", () => {
      setWholesaleMobileMenu(false);
    });

    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        setWholesaleMobileMenu(false);
      });
    });

    // Connect wholesale cards/actions to their live dashboard sections
    dashboard.addEventListener("click", (event) => {
      const button = event.target.closest("[data-wholesale-action]");
      if (!button) return;

      const action = button.dataset.wholesaleAction;

      const actionViews = {
        rfq: "procurement",
        "create-rfq": "procurement",
        orders: "orders",
        production: "production",
        inventory: "inventory",
        reorder: "inventory"
      };

      const targetView = actionViews[action];

      if (targetView) {
        showView(targetView);

        if (action === "create-rfq") {
          setTimeout(() => {
            dashboard.querySelector("#rfqCreatePanel")?.style &&
              (dashboard.querySelector("#rfqCreatePanel").style.display = "block");
            dashboard.querySelector("#rfqTitle")?.focus();
          }, 50);
        }
      }

      if (action === "intelligence") {
        showView("intelligence");
      }
    });
  }

  /* ---------- WHOLESALE LIVE ORDERS ---------- */

  /* ---------- ORDER DETAILS + PAYMENT ---------- */
  function setupOrderDetails() {
    const panel = $("#orderDetailsPanel");
    const content = $("#orderDetailsContent");
    const numberBox = $("#orderDetailsNumber");
    const messageBox = $("#orderDetailsMessage");
    const liveMessage = $("#orderDetailsLiveMessage");
    const closeButton = $("#closeOrderDetailsBtn");

    if (!panel || !content) return;

    function getUserId() {
      if (state.user && state.user.id) {
        return Number(state.user.id);
      }

      const savedUser = localStorage.getItem("zenodic_user");

      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);

          if (parsed && parsed.id) {
            state.user = parsed;
            return Number(parsed.id);
          }
        } catch (error) {
          console.warn("Saved user parse error:", error);
        }
      }

      return 0;
    }

    function money(amount, currency = "TZS") {
      const value = Number(amount || 0);
      return `${value.toLocaleString()} ${currency}`;
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function showMessage(text, isError = false) {
      if (!liveMessage) return;

      liveMessage.textContent = text;
      liveMessage.style.display = "block";
      liveMessage.style.padding = "10px 14px";
      liveMessage.style.borderRadius = "8px";
      liveMessage.style.border = "1px solid";
      liveMessage.style.borderColor = isError ? "#d33" : "#2a8";
    }

    function hideMessage() {
      if (liveMessage) {
        liveMessage.style.display = "none";
      }
    }

    function renderOrder(order, items) {
      if (numberBox) {
        numberBox.textContent =
          order.order_number || `Order #${order.id}`;
      }

      if (messageBox) {
        messageBox.textContent =
          `RFQ #${order.rfq_id ?? "-"} · Supplier: ${order.seller_name || "-"}`;
      }

      const itemRows = Array.isArray(items) && items.length
        ? items.map((item) => `
            <div
              style="
                display:grid;
                grid-template-columns:2fr 1fr 1fr 1fr;
                gap:12px;
                padding:12px 0;
                border-bottom:1px solid rgba(0,0,0,.08);
              "
            >
              <div>
                <strong>${escapeHtml(item.product_name)}</strong>
              </div>

              <div>
                ${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}
              </div>

              <div>
                ${money(item.unit_price, order.currency)}
              </div>

              <div>
                <strong>${money(item.total_price, order.currency)}</strong>
              </div>
            </div>
          `).join("")
        : `
            <div style="padding:12px 0;">
              Hakuna items kwenye order hii.
            </div>
          `;

      const paymentButton =
        order.payment_status === "paid"
          ? `
              <span
                style="
                  display:inline-block;
                  padding:8px 12px;
                  border-radius:8px;
                  border:1px solid #2a8;
                "
              >
                PAID
              </span>
            `
          : `
              <button
                type="button"
                class="primary-btn"
                data-order-payment="${order.id}"
              >
                Pay Now
              </button>
            `;

      content.innerHTML = `
        <div
          style="
            display:grid;
            grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
            gap:16px;
            margin-bottom:22px;
          "
        >
          <div>
            <small>Order Status</small>
            <div><strong>${escapeHtml(order.status || "-")}</strong></div>
          </div>

          <div>
            <small>Payment Status</small>
            <div><strong>${escapeHtml(order.payment_status || "-")}</strong></div>
          </div>

          <div>
            <small>Total</small>
            <div><strong>${money(order.total_amount, order.currency)}</strong></div>
          </div>

          <div>
            <small>Delivery</small>
            <div><strong>${escapeHtml(order.delivery_location || "-")}</strong></div>
          </div>

          <div>
            <small>Expected Delivery</small>
            <div><strong>${escapeHtml(order.expected_delivery || "-")}</strong></div>
          </div>
        </div>

        <div style="margin-bottom:22px;">
          <span class="panel-label">SUPPLIER</span>
          <h4 style="margin:8px 0;">
            ${escapeHtml(order.seller_name || "-")}
          </h4>
          <p style="margin:0;">
            ${escapeHtml(order.seller_email || "-")}
          </p>
        </div>

        <div style="margin-bottom:22px;">
          <span class="panel-label">ITEMS</span>

          <div
            style="
              margin-top:10px;
              overflow-x:auto;
            "
          >
            <div
              style="
                display:grid;
                grid-template-columns:2fr 1fr 1fr 1fr;
                gap:12px;
                padding:10px 0;
                font-weight:700;
                border-bottom:2px solid rgba(0,0,0,.12);
                min-width:650px;
              "
            >
              <div>Product</div>
              <div>Quantity</div>
              <div>Unit Price</div>
              <div>Total</div>
            </div>

            <div style="min-width:650px;">
              ${itemRows}
            </div>
          </div>
        </div>

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:16px;
            flex-wrap:wrap;
            padding-top:16px;
            border-top:1px solid rgba(0,0,0,.1);
          "
        >
          <div>
            <small>Payment</small>
            <div style="margin-top:6px;">
              ${paymentButton}
            </div>
          </div>

          <div style="text-align:right;">
            <small>Order Total</small>
            <div style="font-size:1.25rem;font-weight:700;">
              ${money(order.total_amount, order.currency)}
            </div>
          </div>
        </div>
      `;

      panel.style.display = "block";
      panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    async function loadOrder(orderId) {
      const userId = getUserId();

      if (!userId) {
        showMessage("Ingia kwanza ili kuona order.", true);
        return;
      }

      content.innerHTML = `
        <div class="wholesale-empty-state">
          Loading order details...
        </div>
      `;

      panel.style.display = "block";

      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderId)}?user_id=${encodeURIComponent(userId)}`, { credentials: "include" }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Imeshindikana kupata order."
          );
        }

        hideMessage();

        renderOrder(
          data.order,
          Array.isArray(data.items) ? data.items : []
        );
      } catch (error) {
        console.error("Load order details error:", error);

        content.innerHTML = `
          <div class="wholesale-empty-state">
            Imeshindikana kupakia order details.
          </div>
        `;

        showMessage(
          error.message || "Imeshindikana kupata order.",
          true
        );
      }
    }

    function closeBuyerPaymentModal() {
      const modal = document.getElementById("zenodicBuyerPaymentModal");
      if (modal) modal.remove();
    }

    function setBuyerPaymentMessage(text, isError = false) {
      const box = document.getElementById("zenodicBuyerPaymentMessage");
      if (!box) return;

      box.textContent = text;
      box.style.display = "block";
      box.style.padding = "11px 13px";
      box.style.borderRadius = "10px";
      box.style.background = isError ? "#fff1f1" : "#eef8f3";
      box.style.color = isError ? "#9f1d1d" : "#17663d";
    }

    function normalizeBuyerPhone(phone) {
      let value = String(phone || "").trim().replace(/\s+/g, "");

      if (value.startsWith("+")) {
        value = value.slice(1);
      }

      if (/^0\d{9}$/.test(value)) {
        value = `255${value.slice(1)}`;
      }

      return value;
    }

    function showBuyerPaymentModal(order) {
      closeBuyerPaymentModal();

      const modal = document.createElement("div");
      modal.id = "zenodicBuyerPaymentModal";

      modal.style.cssText =
        "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px;";

      modal.innerHTML = `
        <div style="width:min(460px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.25);">

          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div>
              <div style="font-size:12px;font-weight:700;letter-spacing:.08em;opacity:.65;">
                ZENODIC PAYMENT
              </div>
              <h3 style="margin:5px 0 0;">Pay for order</h3>
            </div>

            <button
              type="button"
              id="closeZenodicPaymentModal"
              style="border:0;background:transparent;font-size:24px;cursor:pointer;"
            >×</button>
          </div>

          <div style="margin-top:20px;padding:16px;border-radius:14px;background:#f6f7f9;">
            <div style="font-size:13px;opacity:.7;">Order</div>
            <strong>${escapeHtml(order.order_number || `#${order.id}`)}</strong>

            <div style="font-size:13px;opacity:.7;margin-top:12px;">Amount</div>
            <strong style="font-size:24px;">
              ${money(order.total_amount, order.currency)}
            </strong>
          </div>

          <div style="margin-top:20px;">
            <label style="display:block;font-weight:700;margin-bottom:7px;">
              Payment method
            </label>

            <select
              id="zenodicPaymentMethod"
              style="width:100%;padding:12px;border:1px solid #d8dce3;border-radius:10px;font-size:15px;background:#fff;"
            >
              <option value="clickpesa_ussd_push">
                Mobile Money — ClickPesa USSD Push
              </option>
            </select>
          </div>

          <div style="margin-top:16px;">
            <label
              for="zenodicPaymentPhone"
              style="display:block;font-weight:700;margin-bottom:7px;"
            >
              Mobile number
            </label>

            <input
              id="zenodicPaymentPhone"
              type="tel"
              inputmode="numeric"
              autocomplete="tel"
              placeholder="0712345678"
              style="width:100%;box-sizing:border-box;padding:13px;border:1px solid #d8dce3;border-radius:10px;font-size:16px;"
            >

            <div style="font-size:12px;opacity:.65;margin-top:7px;">
              Tumia namba ya Tanzania inayopokea USSD-PUSH.
            </div>
          </div>

          <div
            id="zenodicBuyerPaymentMessage"
            style="display:none;margin-top:16px;"
          ></div>

          <button
            type="button"
            id="zenodicStartBuyerPayment"
            class="primary-btn"
            style="width:100%;margin-top:20px;"
          >
            Continue to Payment
          </button>

        </div>
      `;

      document.body.appendChild(modal);

      document
        .getElementById("closeZenodicPaymentModal")
        ?.addEventListener("click", closeBuyerPaymentModal);

      document
        .getElementById("zenodicStartBuyerPayment")
        ?.addEventListener("click", () => startBuyerClickPesaPayment(order));

      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeBuyerPaymentModal();
        }
      });
    }

    async function buyerPaymentRequest(url, options = {}) {
      const response = await fetch(url, {
        credentials: "include",
        ...options
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          data.details ||
          "Payment request failed."
        );
      }

      return data;
    }

    async function pollBuyerPayment(paymentReference, orderId) {
      for (let attempt = 1; attempt <= 30; attempt++) {
        const data = await buyerPaymentRequest(
          `/api/payments/status/${encodeURIComponent(paymentReference)}`
        );

        const payment = data.payment || {};
        const status = String(
          payment.status || data.status || ""
        ).toLowerCase();

        if (status === "paid") {
          setBuyerPaymentMessage(
            "Payment imethibitishwa. Order yako imelipwa."
          );

          await loadOrder(orderId);

          if (
            typeof window.setupWholesaleOrdersRefresh === "function"
          ) {
            window.setupWholesaleOrdersRefresh();
          }

          setTimeout(closeBuyerPaymentModal, 1200);
          return;
        }

        if (
          ["failed", "cancelled", "refunded"].includes(status)
        ) {
          throw new Error(
            payment.message || "Payment haikukamilika."
          );
        }

        setBuyerPaymentMessage(
          `Payment inaendelea... (${attempt}/30)`
        );

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      throw new Error(
        "Payment bado haijathibitishwa. Angalia simu yako na ujaribu tena."
      );
    }

    async function startBuyerClickPesaPayment(order) {
      const userId = getZenodicUserId();

      if (!userId) {
        setBuyerPaymentMessage(
          "Ingia kwanza ili kufanya payment.",
          true
        );
        return;
      }

      const phoneInput =
        document.getElementById("zenodicPaymentPhone");

      const phoneNumber = normalizeBuyerPhone(
        phoneInput?.value || ""
      );

      if (!/^255\d{9}$/.test(phoneNumber)) {
        setBuyerPaymentMessage(
          "Weka namba sahihi ya Tanzania, mfano 0712345678.",
          true
        );
        return;
      }

      const button =
        document.getElementById("zenodicStartBuyerPayment");

      if (button) {
        button.disabled = true;
        button.textContent = "Processing...";
      }

      try {
        setBuyerPaymentMessage(
          "Tunathibitisha payment details..."
        );

        const preview = await buyerPaymentRequest(
          "/api/payments/preview",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              order_id: Number(order.id),
              buyer_id: Number(userId),
              phone_number: phoneNumber
            })
          }
        );

        const paymentReference =
          preview.payment?.payment_reference;

        if (!paymentReference) {
          throw new Error(
            "Payment reference haikupatikana."
          );
        }

        setBuyerPaymentMessage(
          "Tunatuma USSD-PUSH kwenye simu yako..."
        );

        const initiated = await buyerPaymentRequest(
          "/api/payments/ussd-push",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              order_id: Number(order.id),
              buyer_id: Number(userId),
              phone_number: phoneNumber,
              payment_reference: paymentReference
            })
          }
        );

        const providerStatus = String(
          initiated.payment?.status || "PROCESSING"
        ).toUpperCase();

        if (providerStatus === "FAILED") {
          throw new Error(
            "ClickPesa imeshindwa kuanzisha payment."
          );
        }

        if (button) {
          button.style.display = "none";
        }

        setBuyerPaymentMessage(
          "USSD-PUSH imetumwa. Angalia simu yako na ukamilishe payment."
        );

        await pollBuyerPayment(
          paymentReference,
          Number(order.id)
        );

      } catch (error) {
        console.error(
          "Buyer ClickPesa payment error:",
          error
        );

        if (button) {
          button.disabled = false;
          button.style.display = "block";
          button.textContent = "Try Again";
        }

        setBuyerPaymentMessage(
          error.message ||
          "Imeshindikana kuanzisha payment.",
          true
        );
      }
    }
    document.addEventListener("click", (event) => {
      const orderCard = event.target.closest(
        ".wholesale-order-card"
      );

      if (
        orderCard &&
        !event.target.closest("button")
      ) {
        const orderId = orderCard.dataset.orderId;

        if (orderId) {
          loadOrder(orderId);
        }
      }

      const paymentButton = event.target.closest(
        "[data-order-payment]"
      );

      if (paymentButton) {
        event.preventDefault();
        event.stopPropagation();

        const orderId = paymentButton.dataset.orderPayment;

        if (orderId) {
          const userId = getZenodicUserId();

          if (!userId) {
            showMessage("Ingia kwanza ili kufanya payment.", true);
            return;
          }

          fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}?user_id=${encodeURIComponent(userId)}`, {
            credentials: "include"
          })
            .then((response) => response.json())
            .then((data) => {
              if (!data.success || !data.order) {
                throw new Error(data.message || "Order haikupatikana.");
              }

              showBuyerPaymentModal(data.order);
            })
            .catch((error) => {
              console.error("Open payment error:", error);
              showMessage(error.message || "Imeshindikana kufungua payment.", true);
            });
        }
      }
    });

    if (closeButton) {
      closeButton.addEventListener("click", () => {
        panel.style.display = "none";
        hideMessage();
      });
    }

    window.openZenodicOrderDetails = loadOrder;
  }

  /* ---------- SELLER ORDER MANAGEMENT ---------- */
  async function updateSellerOrderStatus(orderId, status) {
    const userId = getUserId();

    if (!userId) {
      showMessage("Ingia kwanza ili kusasisha order.", true);
      return;
    }

    if (!status) {
      showMessage("Chagua status ya order.", true);
      return;
    }

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            user_id: userId,
            status
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Imeshindikana kusasisha order status."
        );
      }

      showMessage(
        data.message || "Order status imebadilishwa."
      );

      if (typeof loadSellerOrders === "function") {
        await loadSellerOrders();
      }

      if (typeof window.openZenodicOrderDetails === "function") {
        await window.openZenodicOrderDetails(orderId);
      }

    } catch (error) {
      console.error("Seller order status update error:", error);

      showMessage(
        error.message || "Imeshindikana kusasisha order status.",
        true
      );
    }
  }


    function updateModernOrderStats(orders) {
      const counts = {
        pending: 0,
        processing: 0,
        completed: 0,
        cancelled: 0
      };

      orders.forEach((order) => {
        const status = String(order.status || "").toLowerCase();
        if (status === "pending") counts.pending++;
        if (status === "processing") counts.processing++;
        if (["completed", "delivered"].includes(status)) counts.completed++;
        if (status === "cancelled") counts.cancelled++;
      });

      const newEl = document.getElementById("modernSellerNewOrders");
      const processingEl = document.getElementById("modernSellerProcessingOrders");
      const completedEl = document.getElementById("modernSellerCompletedOrders");
      const cancelledEl = document.getElementById("modernSellerCancelledOrders");

      if (newEl) newEl.textContent = counts.pending;
      if (processingEl) processingEl.textContent = counts.processing;
      if (completedEl) completedEl.textContent = counts.completed;
      if (cancelledEl) cancelledEl.textContent = counts.cancelled;
    }

    function renderModernOrders(orders, modernList) {
  modernList = modernList || document.getElementById("modernBuyerOrdersList");

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const money = (amount, currency = "TZS") =>
    `${Number(amount || 0).toLocaleString()} ${currency}`;
      if (!modernList) return;

      if (!orders.length) {
        modernList.innerHTML = `
          <div class="seller-order-empty">
            <div class="seller-order-empty-icon">🛒</div>
            <strong>Hakuna buyer orders bado</strong>
            <p>Orders kutoka kwa wanunuzi zitaonekana hapa.</p>
          </div>
        `;
        return;
      }

      modernList.innerHTML = orders.map((order) => `
        <article class="seller-modern-order-card">
          <div class="seller-modern-order-top">
            <div>
              <span class="seller-app-eyebrow">ORDER</span>
              <h3>${escapeHtml(order.order_number || `#${order.id}`)}</h3>
              <p>Buyer: ${escapeHtml(order.buyer_name || "-")}</p>
            </div>
            <strong>${money(order.total_amount, order.currency)}</strong>
          </div>

          <div class="seller-modern-order-meta">
            <div>
              <span>Status</span>
              <strong>${escapeHtml(order.status || "-")}</strong>
            </div>
            <div>
              <span>Payment</span>
              <strong>${escapeHtml(order.payment_status || "-")}</strong>
            </div>
            <div>
              <span>Delivery</span>
              <strong>${escapeHtml(order.delivery_location || "-")}</strong>
            </div>
          </div>

          <div class="seller-modern-order-actions">
        <select class="seller-modern-status-select" data-seller-status-order="${order.id}">
          <option value="pending" ${order.status === "pending" ? "selected" : ""}>Pending</option>
          <option value="confirmed" ${order.status === "confirmed" ? "selected" : ""}>Confirmed</option>
          <option value="processing" ${order.status === "processing" ? "selected" : ""}>Processing</option>
          <option value="shipped" ${order.status === "shipped" ? "selected" : ""}>Shipped</option>
          <option value="delivered" ${order.status === "delivered" ? "selected" : ""}>Delivered</option>
          <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>Cancelled</option>
        </select>
            <button type="button" class="primary-btn" data-update-seller-status="${order.id}">
              Update Status
            </button>
            <button type="button" class="secondary-btn" data-open-seller-order="${order.id}">
              View Details
            </button>
          </div>
        </article>
      `).join("");
    }


  async function openSellerOrderDetails(orderId) {
    const panel = document.getElementById("sellerOrderDetailsPanel");
    const content = document.getElementById("sellerOrderDetailsContent");
    const numberBox = document.getElementById("sellerOrderDetailsNumber");
    const buyerBox = document.getElementById("sellerOrderDetailsBuyer");

    if (!panel || !content) return;

    const savedUser = localStorage.getItem("zenodic_user");
    let userId = state.user?.id ? Number(state.user.id) : 0;

    if (!userId && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        userId = Number(parsed?.id || 0);
      } catch (_) {}
    }

    if (!userId) {
      content.innerHTML = `<div class="wholesale-empty-state">Ingia kwanza ili kuona order.</div>`;
      panel.style.display = "block";
      return;
    }

    panel.style.display = "block";
    content.innerHTML = `<div class="wholesale-empty-state">Loading order details...</div>`;

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}?user_id=${encodeURIComponent(userId)}`,
        { credentials: "include" }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Imeshindikana kupata order details.");
      }

      const order = data.order || {};
      const items = Array.isArray(data.items) ? data.items : [];

      if (numberBox) {
        numberBox.textContent = order.order_number || `Order #${order.id}`;
      }

      if (buyerBox) {
        buyerBox.textContent = `Buyer: ${order.buyer_name || "-"}`;
      }

      const money = (amount, currency = "TZS") =>
        `${Number(amount || 0).toLocaleString()} ${currency}`;

      const escapeHtml = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

      content.innerHTML = `
        <div>
          <span>Status</span>
          <strong>${escapeHtml(order.status || "-")}</strong>
        </div>
        <div>
          <span>Payment</span>
          <strong>${escapeHtml(order.payment_status || "-")}</strong>
        </div>
        <div>
          <span>Delivery</span>
          <strong>${escapeHtml(order.delivery_location || "-")}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>${money(order.total_amount, order.currency)}</strong>
        </div>
        <div>
          <span>Expected delivery</span>
          <strong>${escapeHtml(order.expected_delivery || "-")}</strong>
        </div>
        <div>
          <span>Items</span>
          <strong>${items.length}</strong>
        </div>
      `;
    } catch (error) {
      console.error("Seller order details error:", error);
      content.innerHTML = `<div class="wholesale-empty-state">Imeshindikana kupakia order details.</div>`;
    }
  }

    function setupSellerOrders() {
    const list = $("#sellerOrdersList");
    const modernList = $("#modernBuyerOrdersList");
    const messageBox = $("#sellerOrdersMessage");
    const refreshButton = $("#refreshSellerOrdersBtn");

    if (!list && !modernList) return;

    function getUserId() {
      if (state.user && state.user.id) {
        return Number(state.user.id);
      }

      const savedUser = localStorage.getItem("zenodic_user");

      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);

          if (parsed && parsed.id) {
            state.user = parsed;
            return Number(parsed.id);
          }
        } catch (error) {
          console.warn("Saved user parse error:", error);
        }
      }

      return 0;
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function money(amount, currency = "TZS") {
      return `${Number(amount || 0).toLocaleString()} ${currency}`;
    }

    function showMessage(text, isError = false) {
      if (!messageBox) return;

      messageBox.textContent = text;
      messageBox.style.display = "block";
      messageBox.style.padding = "10px 14px";
      messageBox.style.borderRadius = "8px";
      messageBox.style.border = "1px solid";
      messageBox.style.borderColor = isError ? "#d33" : "#2a8";
    }

    function hideMessage() {
      if (messageBox) {
        messageBox.style.display = "none";
      }
    }

    function renderOrders(orders) {
    if (!list) return;
      if (!orders.length) {
        list.innerHTML = `
          <div class="wholesale-empty-state">
            Hakuna orders ulizopokea kwa sasa.
          </div>
        `;
        return;
      }

      list.innerHTML = orders.map((order) => `
        <div
          class="wholesale-order-card"
          data-seller-order-id="${order.id}"
          style="
            border:1px solid rgba(0,0,0,.1);
            border-radius:12px;
            padding:18px;
            margin-bottom:14px;
          "
        >

          <div
            style="
              display:flex;
              justify-content:space-between;
              gap:16px;
              align-items:flex-start;
              flex-wrap:wrap;
            "
          >

            <div>
              <span class="panel-label">ORDER</span>

              <h4 style="margin:6px 0;">
                ${escapeHtml(order.order_number || `#${order.id}`)}
              </h4>

              <p style="margin:0;">
                Buyer: ${escapeHtml(order.buyer_name || "-")}
              </p>
            </div>

            <div>
              <strong>
                ${money(order.total_amount, order.currency)}
              </strong>
            </div>

          </div>

          <div
            style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
              gap:12px;
              margin-top:16px;
            "
          >

            <div>
              <small>Status</small>

              <div>
                <strong>
                  ${escapeHtml(order.status || "-")}
                </strong>
              </div>
            </div>

            <div>
              <small>Payment</small>

              <div>
                <strong>
                  ${escapeHtml(order.payment_status || "-")}
                </strong>
              </div>
            </div>

            <div>
              <small>Delivery</small>

              <div>
                <strong>
                  ${escapeHtml(order.delivery_location || "-")}
                </strong>
              </div>
            </div>

            <div>
              <small>Expected</small>

              <div>
                <strong>
                  ${escapeHtml(order.expected_delivery || "-")}
                </strong>
              </div>
            </div>

          </div>

          <div
            style="
              display:flex;
              gap:10px;
              align-items:center;
              flex-wrap:wrap;
              margin-top:18px;
              padding-top:16px;
              border-top:1px solid rgba(0,0,0,.08);
            "
          >

            <label>
              <small>Update Status</small>

              <select
                data-seller-status-order="${order.id}"
                style="
                  display:block;
                  margin-top:6px;
                  padding:9px 12px;
                  border-radius:8px;
                  border:1px solid rgba(0,0,0,.2);
                "
              >
                <option value="pending" ${order.status === "pending" ? "selected" : ""}>
                  Pending
                </option>

                <option value="confirmed" ${order.status === "confirmed" ? "selected" : ""}>
                  Confirmed
                </option>

                <option value="processing" ${order.status === "processing" ? "selected" : ""}>
                  Processing
                </option>

                <option value="shipped" ${order.status === "shipped" ? "selected" : ""}>
                  Shipped
                </option>

                <option value="delivered" ${order.status === "delivered" ? "selected" : ""}>
                  Delivered
                </option>

                <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>
                  Cancelled
                </option>
              </select>
            </label>

            <button
              type="button"
              class="primary-btn"
              data-update-seller-status="${order.id}"
            >
              Update Status
            </button>

            <button
              type="button"
              class="secondary-btn"
              data-open-seller-order="${order.id}"
            >
              View Details
            </button>

          </div>

        </div>
      `).join("");
    }

    window.loadSellerOrders = loadSellerOrders;
    async function loadSellerOrders() {
      const sellerId = getUserId();
    console.log("SELLER ORDERS DEBUG:", { sellerId, stateUser: state.user, savedUser: localStorage.getItem("zenodic_user") });

      if (!sellerId) {
        list.innerHTML = `
          <div class="wholesale-empty-state">
            Ingia kwanza ili kuona seller orders.
          </div>
        `;
        return;
      }

      list.innerHTML = `
        <div class="wholesale-empty-state">
          Loading seller orders...
        </div>
      `;

      try {
        const response = await fetch(
          `/api/orders/seller/${encodeURIComponent(sellerId)}`
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Imeshindikana kupata seller orders."
          );
        }

        hideMessage();

        const orders = Array.isArray(data.orders) ? data.orders : [];
        updateModernOrderStats(orders);
        renderOrders(orders);
        renderModernOrders(orders, modernList);

      } catch (error) {
        console.error("Load seller orders error:", error);
      console.error("SELLER ORDERS FULL ERROR:", error?.stack || error);

        list.innerHTML = `
          <div class="wholesale-empty-state">
            Imeshindikana kupakia seller orders.
          </div>
        `;

        showMessage(
          error.message || "Imeshindikana kupata seller orders.",
          true
        );
      }
    }

    async function updateSellerStatus(orderId) {
      const sellerId = getUserId();
    console.log("SELLER ORDERS DEBUG:", { sellerId, stateUser: state.user, savedUser: localStorage.getItem("zenodic_user") });

      const select = document.querySelector(
        `[data-seller-status-order="${orderId}"]`
      );

      if (!select) return;

      const status = select.value;

      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderId)}/status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              user_id: sellerId,
              status
            })
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Imeshindikana kubadilisha order status."
          );
        }

        showMessage(
          data.message || "Order status imebadilishwa."
        );

        await loadSellerOrders();

      } catch (error) {
        console.error("Update seller order status error:", error);

        showMessage(
          error.message || "Imeshindikana kubadilisha status.",
          true
        );
      }
    }

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        loadSellerOrders
      );
    }

    document.addEventListener("click", (event) => {

      const updateButton = event.target.closest(
        "[data-update-seller-status]"
      );

      if (updateButton) {
        event.preventDefault();

        updateSellerStatus(
          updateButton.dataset.updateSellerStatus
        );

        return;
      }

      const detailsButton = event.target.closest(
        "[data-open-seller-order]"
      );

      if (detailsButton) {
        event.preventDefault();

        const orderId =
          detailsButton.dataset.openSellerOrder;

        if (orderId) {
          openSellerOrderDetails(orderId);
        }
      }
    });

    loadSellerOrders();

    window.refreshSellerOrders = loadSellerOrders;
  }


  /* ---------- SELLER SALES OVERVIEW ---------- */

  function setupSellerOverview() {
    const cards = document.querySelector("#sellerOverviewCards");
    const recent = document.querySelector("#sellerRecentOrders");
    const pipeline = document.querySelector("#sellerOrderPipeline");
    const messageBox = document.querySelector("#sellerOverviewMessage");
    const refreshButton = document.querySelector("#refreshSellerOverviewBtn");

    if (!cards && !recent && !pipeline) return;

    function getSellerId() {
      if (state.user && state.user.id) {
        return Number(state.user.id);
      }

      const savedUser = localStorage.getItem("zenodic_user");

      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);

          if (parsed && parsed.id) {
            state.user = parsed;
            return Number(parsed.id);
          }
        } catch (error) {
          console.warn("Seller overview user parse error:", error);
        }
      }

      return 0;
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function money(amount, currency) {
      return Number(amount || 0).toLocaleString() + " " + (currency || "TZS");
    }

    function showMessage(text, isError) {
      if (!messageBox) return;

      messageBox.textContent = text;
      messageBox.style.display = "block";
      messageBox.style.padding = "10px 14px";
      messageBox.style.borderRadius = "8px";
      messageBox.style.border = "1px solid";
      messageBox.style.borderColor = isError ? "#d33" : "#2a8";
    }

    function hideMessage() {
      if (messageBox) {
        messageBox.style.display = "none";
      }
    }

    function renderCards(summary, currency) {
      if (!cards) return;

      function card(label, value, note) {
        return (
          '<div style="border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:18px;background:#fff;">' +
            '<small style="color:#718096;">' + escapeHtml(label) + '</small>' +
            '<div style="font-size:1.35rem;font-weight:800;margin-top:7px;">' +
              escapeHtml(value) +
            '</div>' +
            (note
              ? '<div style="font-size:.82rem;color:#718096;margin-top:5px;">' +
                  escapeHtml(note) +
                '</div>'
              : '') +
          '</div>'
        );
      }

      cards.innerHTML =
        card("Total Sales", money(summary.total_sales, currency), "Jumla ya mauzo") +
        card("Paid Earnings", money(summary.paid_earnings, currency), "Malipo yaliyothibitishwa") +
        card("Unpaid", money(summary.unpaid_amount, currency), "Fedha bado haijalipwa") +
        card("Total Orders", Number(summary.total_orders || 0).toLocaleString(), "Orders zote") +
        card("Pending", Number(summary.pending_orders || 0).toLocaleString()) +
        card("Processing", Number(summary.processing_orders || 0).toLocaleString()) +
        card("Shipped", Number(summary.shipped_orders || 0).toLocaleString()) +
        card("Delivered", Number(summary.delivered_orders || 0).toLocaleString());
    }

    function renderPipeline(summary) {
      if (!pipeline) return;

      const stages = [
        ["Pending", summary.pending_orders],
        ["Confirmed", summary.confirmed_orders],
        ["Processing", summary.processing_orders],
        ["Shipped", summary.shipped_orders],
        ["Delivered", summary.delivered_orders],
        ["Cancelled", summary.cancelled_orders]
      ];

      pipeline.innerHTML = stages.map(function(stage) {
        return (
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(0,0,0,.06);">' +
            '<span>' + escapeHtml(stage[0]) + '</span>' +
            '<strong>' + Number(stage[1] || 0).toLocaleString() + '</strong>' +
          '</div>'
        );
      }).join("");
    }

    function renderRecentOrders(orders, currency) {
      if (!recent) return;

      if (!orders.length) {
        recent.innerHTML =
          '<div class="wholesale-empty-state">Hakuna sales bado.</div>';
        return;
      }

      recent.innerHTML = orders.map(function(order) {
        return (
          '<div style="display:grid;grid-template-columns:1.4fr 1fr .9fr 1fr;gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid rgba(0,0,0,.07);min-width:650px;">' +
            '<div>' +
              '<strong>' + escapeHtml(order.order_number || ("#" + order.id)) + '</strong>' +
              '<div style="font-size:.82rem;color:#718096;">' +
                escapeHtml(order.buyer_name || "Buyer") +
              '</div>' +
            '</div>' +
            '<div>' + escapeHtml(order.status || "-") + '</div>' +
            '<div>' + escapeHtml(order.payment_status || "-") + '</div>' +
            '<div style="font-weight:700;">' +
              money(order.total_amount, order.currency || currency) +
            '</div>' +
          '</div>'
        );
      }).join("");
    }

    function renderLast7Days(days, currency) {
      if (!recent || !Array.isArray(days) || !days.length) return;

      const rows = days.map(function(day) {
        return (
          '<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid rgba(0,0,0,.06);">' +
            '<span>' + escapeHtml(day.date || "-") + '</span>' +
            '<strong>' + money(day.sales, currency) + '</strong>' +
          '</div>'
        );
      }).join("");

      recent.innerHTML +=
        '<div style="margin-top:24px;padding-top:18px;border-top:1px solid rgba(0,0,0,.08);">' +
          '<span class="panel-label">LAST 7 DAYS</span>' +
          '<h4 style="margin:6px 0 10px;">Sales Trend</h4>' +
          rows +
        '</div>';
    }

    async function loadSellerOverview() {
      const sellerId = getSellerId();

      if (!sellerId) {
        showMessage("Ingia kwanza ili kuona business analytics.", true);
        return;
      }

      if (cards) {
        cards.innerHTML =
          '<div class="wholesale-empty-state">Loading business analytics...</div>';
      }

      try {
        const response = await fetch(
          "/api/orders/seller/" + encodeURIComponent(sellerId) + "/overview"
        );

        const data = await response.json().catch(function() {
          return {};
        });

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Imeshindikana kupata seller overview."
          );
        }

        hideMessage();

        const currency =
          data.recentOrders &&
          data.recentOrders.length &&
          data.recentOrders[0].currency
            ? data.recentOrders[0].currency
            : "TZS";

        renderCards(data.summary || {}, currency);
        renderPipeline(data.summary || {});
        renderRecentOrders(
          Array.isArray(data.recentOrders) ? data.recentOrders : [],
          currency
        );
        renderLast7Days(
          Array.isArray(data.salesLast7Days) ? data.salesLast7Days : [],
          currency
        );

      } catch (error) {
        console.error("Seller overview error:", error);

        if (cards) {
          cards.innerHTML =
            '<div class="wholesale-empty-state">Imeshindikana kupakia business analytics.</div>';
        }

        if (recent) recent.innerHTML = "";
        if (pipeline) pipeline.innerHTML = "";

        showMessage(
          error.message || "Imeshindikana kupata seller overview.",
          true
        );
      }
    }

    if (refreshButton) {
      refreshButton.addEventListener("click", loadSellerOverview);
    }

    window.refreshSellerOverview = loadSellerOverview;

    loadSellerOverview();
  }


  /* ---------- SELLER EARNINGS ---------- */



  // ============================================================
  // MODERN SELLER DASHBOARD NAVIGATION
  // ============================================================
  function setupSellerProducts() {
    const list = $("#sellerProductList");
    const form = $("#sellerProductForm");

    if (!list || !form) return;

    let productsCache = [];

    function getSellerId() {
      if (state.user && state.user.id) {
        return Number(state.user.id);
      }

      const savedUser = localStorage.getItem("zenodic_user");

      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);

          if (parsed && parsed.id) {
            state.user = parsed;
            return Number(parsed.id);
          }
        } catch (error) {
          console.warn("Saved seller user parse error:", error);
        }
      }

      return 0;
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function formatPrice(value) {
      if (value === null || value === undefined || value === "") {
        return "Bei haijawekwa";
      }

      const number = Number(value);

      if (!Number.isFinite(number)) {
        return "Bei haijawekwa";
      }

      return number.toLocaleString() + " TZS";
    }

    function renderProducts(products) {
      productsCache = Array.isArray(products) ? products : [];

      if (!productsCache.length) {
        list.innerHTML = `
          <div class="seller-app-empty">
            <div style="font-size:40px;margin-bottom:8px;">📦</div>
            <strong>Hakuna bidhaa bado</strong>
            <p>Weka bidhaa yako ya kwanza kwenye tangazo.</p>
          </div>
        `;
        return;
      }

      list.innerHTML = productsCache.map(product => {
        const stock = Number(product.quantity || 0);
        const phone = product.phone ? String(product.phone).trim() : "";
        const whatsappPhone = phone.replace(/[^0-9]/g, "");

        const whatsappUrl = whatsappPhone
          ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
              `Habari, ninaulizia bidhaa: ${product.item_name}`
            )}`
          : "";

        return `
          <article
            class="seller-product-card"
            data-product-id="${Number(product.id)}"
            style="
              border:1px solid #e5e7eb;
              border-radius:16px;
              overflow:hidden;
              background:#fff;
              margin-bottom:16px;
            "
          >
            ${
              product.image_url
                ? `
                  <img
                    src="${escapeHtml(product.image_url)}"
                    alt="${escapeHtml(product.item_name)}"
                    style="
                      width:100%;
                      height:220px;
                      object-fit:cover;
                      display:block;
                    "
                  >
                `
                : `
                  <div style="
                    height:180px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    background:#f3f4f6;
                    font-size:48px;
                  ">📦</div>
                `
            }

            <div style="padding:16px;">
              <div style="
                display:flex;
                justify-content:space-between;
                gap:12px;
                align-items:flex-start;
              ">
                <div>
                  <h3 style="margin:0 0 6px;">
                    ${escapeHtml(product.item_name)}
                  </h3>

                  ${
                    product.description
                      ? `
                        <p style="margin:0 0 10px;color:#6b7280;">
                          ${escapeHtml(product.description)}
                        </p>
                      `
                      : ""
                  }
                </div>

                <strong style="white-space:nowrap;">
                  ${escapeHtml(formatPrice(product.price))}
                </strong>
              </div>

              <div style="
                display:flex;
                flex-wrap:wrap;
                gap:8px;
                margin:12px 0;
              ">
                <span class="seller-product-meta">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg> ${stock} ${escapeHtml(product.unit || "pcs")}
                </span>

                ${
                  product.location
                    ? `
                      <span class="seller-product-meta">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg> ${escapeHtml(product.location)}
                      </span>
                    `
                    : ""
                }
              </div>

              ${
                phone
                  ? `
                    <div style="margin-bottom:12px;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L9 10.9a16 16 0 0 0 4.1 4.1l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z"/></svg> ${escapeHtml(phone)}
                    </div>
                  `
                  : ""
              }

              <div style="
                display:flex;
                flex-wrap:wrap;
                gap:8px;
              ">
                <button
                  type="button"
                  class="seller-product-view-btn"
                  data-product-id="${Number(product.id)}"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg> View
                </button>

                <button
                  type="button"
                  class="seller-product-edit-btn"
                  data-product-id="${Number(product.id)}"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg> Edit
                </button>

                <button
                  type="button"
                  class="seller-product-delete-btn"
                  data-product-id="${Number(product.id)}"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg> Delete
                </button>

                ${
                  phone
                    ? `
                      <a
                        href="tel:${escapeHtml(phone)}"
                        class="seller-product-contact-btn"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L9 10.9a16 16 0 0 0 4.1 4.1l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z"/></svg> Call
                      </a>
                    `
                    : ""
                }

                ${
                  whatsappUrl
                    ? `
                      <a
                        href="${escapeHtml(whatsappUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="seller-product-contact-btn"
                      >
                        WhatsApp
                      </a>
                    `
                    : ""
                }
              </div>
            </div>
          </article>
        `;
      }).join("");

      bindProductActions();
    }

    function showProduct(product) {
      const price = formatPrice(product.price);

      alert(
        `${product.item_name}

` +
        `${product.description || "Hakuna maelezo"}

` +
        `Bei: ${price}
` +
        `Stock: ${product.quantity || 0} ${product.unit || "pcs"}
` +
        `Location: ${product.location || "Haijawekwa"}
` +
        `Phone: ${product.phone || "Haijawekwa"}`
      );
    }

    async function editProduct(product) {
      const sellerId = getSellerId();

      const name = prompt("Jina la bidhaa:", product.item_name || "");
      if (name === null) return;

      if (!name.trim()) {
        alert("Jina la bidhaa linahitajika.");
        return;
      }

      const description = prompt(
        "Maelezo ya bidhaa:",
        product.description || ""
      );
      if (description === null) return;

      const price = prompt(
        "Bei:",
        product.price ?? ""
      );
      if (price === null) return;

      const quantity = prompt(
        "Stock / Quantity:",
        product.quantity ?? 0
      );
      if (quantity === null) return;

      const location = prompt(
        "Location:",
        product.location || ""
      );
      if (location === null) return;

      const phone = prompt(
        "Phone / WhatsApp:",
        product.phone || ""
      );
      if (phone === null) return;

      const response = await fetch(
        `/api/inventory/seller/${encodeURIComponent(sellerId)}/${encodeURIComponent(product.id)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            item_name: name.trim(),
            item_type: product.item_type || "finished_product",
            sku: product.sku || null,
            quantity: Number(quantity) || 0,
            reorder_level: Number(product.reorder_level) || 0,
            unit: product.unit || "pcs",
            location: location.trim() || null,
            image_url: product.image_url || null,
            description: description.trim() || null,
            price: price.trim() === "" ? null : Number(price),
            phone: phone.trim() || null
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Imeshindikana kuhariri bidhaa."
        );
      }

      alert("Bidhaa imehaririwa.");
      await loadSellerProducts();
    }

    async function deleteProduct(product) {
      const sellerId = getSellerId();

      const confirmed = confirm(
        `Una uhakika unataka kufuta "${product.item_name}"?`
      );

      if (!confirmed) return;

      try {
        const response = await fetch(
          `/api/inventory/seller/${encodeURIComponent(sellerId)}/${encodeURIComponent(product.id)}`,
          {
            method: "DELETE"
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Imeshindikana kufuta bidhaa."
          );
        }

        alert("Bidhaa imefutwa.");
        await loadSellerProducts();
      } catch (error) {
        console.error("Delete seller product error:", error);
        alert(error.message || "Imeshindikana kufuta bidhaa.");
      }
    }

    function bindProductActions() {
      list.querySelectorAll(".seller-product-view-btn")
        .forEach(button => {
          button.addEventListener("click", () => {
            const product = productsCache.find(
              item => Number(item.id) === Number(button.dataset.productId)
            );

            if (product) showProduct(product);
          });
        });

      list.querySelectorAll(".seller-product-edit-btn")
        .forEach(button => {
          button.addEventListener("click", async () => {
            const product = productsCache.find(
              item => Number(item.id) === Number(button.dataset.productId)
            );

            if (!product) return;

            try {
              await editProduct(product);
            } catch (error) {
              console.error("Edit seller product error:", error);
              alert(error.message || "Imeshindikana kuhariri bidhaa.");
            }
          });
        });

      list.querySelectorAll(".seller-product-delete-btn")
        .forEach(button => {
          button.addEventListener("click", async () => {
            const product = productsCache.find(
              item => Number(item.id) === Number(button.dataset.productId)
            );

            if (product) {
              await deleteProduct(product);
            }
          });
        });
    }

    async function loadSellerProducts() {
      const sellerId = getSellerId();

      if (!sellerId) {
        list.innerHTML = `
          <div class="seller-app-empty">
            Ingia kama seller kwanza.
          </div>
        `;
        return;
      }

      list.innerHTML = `
        <div class="seller-app-empty">
          Loading products...
        </div>
      `;

      try {
        const response = await fetch(
          `/api/inventory/seller/${encodeURIComponent(sellerId)}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Imeshindikana kupata bidhaa."
          );
        }

        renderProducts(data.products || []);
      } catch (error) {
        console.error("Seller products load error:", error);

        list.innerHTML = `
          <div class="seller-app-empty">
            Imeshindikana kupakia bidhaa.
          </div>
        `;
      }
    }

    async function addSellerProduct(event) {
      event.preventDefault();

      const sellerId = getSellerId();

      const nameInput = $("#sellerProductName");
      const descriptionInput = $("#sellerProductDescription");
      const priceInput = $("#sellerProductPrice");
      const quantityInput = $("#sellerProductQuantity");
      const unitInput = $("#sellerProductUnit");
      const locationInput = $("#sellerProductLocation");
      const phoneInput = $("#sellerProductPhone");
      const imageInput = $("#sellerProductImage");
  const videoInput = $("#sellerProductVideo");

      const itemName = nameInput?.value.trim();
      const description = descriptionInput?.value.trim() || null;
      const price = priceInput?.value || null;
      const quantity = Number(quantityInput?.value || 0);
      const unit = unitInput?.value.trim() || "pcs";
      const location = locationInput?.value.trim() || null;
      const phone = phoneInput?.value.trim() || null;
      const imageFile = imageInput?.files?.[0];
  const videoFile = videoInput?.files?.[0];

      if (!sellerId) {
        alert("Seller hajapatikana. Tafadhali login tena.");
        return;
      }

      if (!itemName) {
        alert("Weka jina la bidhaa.");
        nameInput?.focus();
        return;
      }

      if (quantity < 0) {
        alert("Stock haiwezi kuwa chini ya 0.");
        return;
      }

      if (!imageFile) {
        alert("Weka picha ya bidhaa.");
        imageInput?.focus();
        return;
      }

      if (videoFile) {
    if (!videoFile.type.startsWith("video/")) {
      alert("File ya video lazima iwe video.");
      return;
    }
    if (videoFile.size > 50 * 1024 * 1024) {
      alert("Video isiwe zaidi ya 50MB.");
      return;
    }
  }

  if (!imageFile.type.startsWith("image/")) {
        alert("File lazima iwe picha.");
        return;
      }

      if (imageFile.size > 5 * 1024 * 1024) {
        alert("Picha isiwe zaidi ya 5MB.");
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Posting...";
      }

      try {
        const imageUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => resolve(reader.result);

          reader.onerror = () => reject(
            new Error("Imeshindikana kusoma picha.")
          );

          reader.readAsDataURL(imageFile);
        });

        let videoUrl = null;

    if (videoFile) {
      const videoFormData = new FormData();
      videoFormData.append("video", videoFile);

      const videoResponse = await fetch(API_BASE + "/api/inventory/video", {
        method: "POST",
        body: videoFormData
      });

      const videoData = await videoResponse.json().catch(() => ({}));

      if (!videoResponse.ok || !videoData.success) {
        throw new Error(
          videoData.message || "Imeshindikana kupakia video."
        );
      }

      videoUrl = videoData.video_url;
    }

    const response = await fetch(
          `/api/inventory/seller/${encodeURIComponent(sellerId)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              item_name: itemName,
              item_type: "finished_product",
              quantity,
              unit,
              location,
              description,
              price: price === "" ? null : Number(price),
              phone,
              image_url: imageUrl,
                        video_url: videoUrl
            })
          }
        );

        const contentType = response.headers.get("content-type") || "";
        const rawResponse = await response.text();

        let data = {};

        if (contentType.includes("application/json")) {
          try {
            data = JSON.parse(rawResponse);
          } catch (parseError) {
            console.error("Invalid JSON response:", rawResponse);
            throw new Error("Server imerudisha JSON isiyosahihi.");
          }
        } else {
          console.error("Unexpected server response:", rawResponse);
          throw new Error(
            response.status === 404
              ? "API ya kuongeza bidhaa haijapatikana."
              : `Server imerudisha HTML badala ya JSON (HTTP ${response.status}).`
          );
        }

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Imeshindikana kuongeza bidhaa."
          );
        }

        form.reset();

        if (unitInput) {
          unitInput.value = "pcs";
        }

        alert("Bidhaa imewekwa kwenye matangazo.");

        await loadSellerProducts();
      } catch (error) {
        console.error("Add seller product error:", error);
        alert(
          error.message ||
          "Imeshindikana kuongeza bidhaa."
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "＋ Post Product";
        }
      }
    }

    if (!form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", addSellerProduct);
    }

    window.refreshSellerProducts = loadSellerProducts;

    loadSellerProducts();
  }

  function setupSellerEarnings() {
    const cards = $("#sellerEarningsCards");
    const transactions = $("#sellerEarningsTransactions");
    const monthly = $("#sellerMonthlyEarnings");
    const messageBox = $("#sellerEarningsMessage");
    const refreshButton = $("#refreshSellerEarningsBtn");

    if (!cards) return;

    function getSellerId() {
      if (state.user && state.user.id) {
        return Number(state.user.id);
      }

      const savedUser = localStorage.getItem("zenodic_user");

      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);

          if (parsed && parsed.id) {
            state.user = parsed;
            return Number(parsed.id);
          }
        } catch (error) {
          console.warn("Saved seller user parse error:", error);
        }
      }

      return 0;
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function money(amount, currency = "TZS") {
      return `${Number(amount || 0).toLocaleString()} ${currency}`;
    }

    function showMessage(text, isError = false) {
      if (!messageBox) return;

      messageBox.textContent = text;
      messageBox.style.display = "block";
      messageBox.style.padding = "10px 14px";
      messageBox.style.borderRadius = "8px";
      messageBox.style.border = "1px solid";
      messageBox.style.borderColor = isError ? "#d33" : "#2a8";
    }

    function hideMessage() {
      if (messageBox) {
        messageBox.style.display = "none";
      }
    }

    function renderCards(summary) {
      const totalSales = Number(summary.total_sales || 0);
      const paidEarnings = Number(summary.paid_earnings || 0);
      const pendingEarnings = Number(summary.pending_earnings || 0);
      const totalOrders = Number(summary.total_orders || 0);

      cards.innerHTML = `
        <div class="seller-earnings-card seller-earnings-main">
          <div class="seller-earnings-card-icon">💰</div>
          <div class="seller-earnings-card-content">
            <span>Total Earnings</span>
            <strong>${money(totalSales)}</strong>
            <small>Mapato yako yote</small>
          </div>
        </div>

        <div class="seller-earnings-card">
          <div class="seller-earnings-card-icon">📈</div>
          <div class="seller-earnings-card-content">
            <span>Paid Earnings</span>
            <strong>${money(paidEarnings)}</strong>
            <small>Malipo yaliyothibitishwa</small>
          </div>
        </div>

        <div class="seller-earnings-card">
          <div class="seller-earnings-card-icon">⏳</div>
          <div class="seller-earnings-card-content">
            <span>Pending</span>
            <strong>${money(pendingEarnings)}</strong>
            <small>Fedha bado hazijalipwa</small>
          </div>
        </div>

        <div class="seller-earnings-card">
          <div class="seller-earnings-card-icon">🧾</div>
          <div class="seller-earnings-card-content">
            <span>Transactions</span>
            <strong>${totalOrders.toLocaleString()}</strong>
            <small>Orders zote</small>
          </div>
        </div>
      `;
    }
    function renderTransactions(rows) {
      if (!transactions) return;

      if (!rows.length) {
        transactions.innerHTML = `
          <div class="seller-earnings-empty">
            <div class="seller-order-empty-icon">🧾</div>
            <strong>Hakuna transactions bado</strong>
            <p>Transactions zitaonekana hapa baada ya kupata orders na payments.</p>
          </div>
        `;
        return;
      }

      transactions.innerHTML = `
        <div class="seller-transactions-table">
          <div class="seller-transaction-head">
            <span>Order</span>
            <span>Date</span>
            <span>Status</span>
            <span>Payment</span>
            <span>Amount</span>
          </div>

          ${rows.map(row => {
            const status = String(row.status || "pending").toLowerCase();
            const payment = String(row.payment_status || "pending").toLowerCase();

            return `
              <div class="seller-transaction-row">
                <div class="seller-transaction-order">
                  <strong>${escapeHtml(row.order_number || `#${row.id}`)}</strong>
                  <small>Order #${row.id}</small>
                </div>

                <div class="seller-transaction-date">
                  ${escapeHtml(row.created_at || "-")}
                </div>

                <div>
                  <span class="seller-status-badge status-${escapeHtml(status)}">
                    ${escapeHtml(status)}
                  </span>
                </div>

                <div>
                  <span class="seller-payment-badge payment-${escapeHtml(payment)}">
                    ${escapeHtml(payment)}
                  </span>
                </div>

                <div class="seller-transaction-amount">
                  ${money(row.total_amount, row.currency)}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    function renderMonthly(rows) {
      if (!monthly) return;

      if (!rows.length) {
        monthly.innerHTML = `
          <div class="seller-earnings-empty">
            <div class="seller-order-empty-icon">📊</div>
            <strong>Hakuna monthly data bado</strong>
            <p>Sales trend itaonekana hapa baada ya biashara kuanza kupata orders.</p>
          </div>
        `;
        return;
      }

      monthly.innerHTML = `
        <div class="seller-monthly-header">
          <div>
            <strong>Monthly Performance</strong>
            <span>Muhtasari wa sales kwa miezi iliyopita.</span>
          </div>
        </div>

        <div class="seller-monthly-list">
          ${rows.map(row => `
            <div class="seller-monthly-row">
              <div class="seller-monthly-month">
                <strong>${escapeHtml(row.month || "-")}</strong>
                <small>${Number(row.orders || 0).toLocaleString()} orders</small>
              </div>

              <div class="seller-monthly-sales">
                <span>Total Sales</span>
                <strong>${money(row.sales)}</strong>
              </div>

              <div class="seller-monthly-paid">
                <span>Paid</span>
                <strong>${money(row.paid_sales)}</strong>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    async function loadSellerEarnings() {
      const sellerId = getSellerId();

      if (!sellerId) {
        cards.innerHTML = `
          <div class="wholesale-empty-state">
            Ingia kwanza ili kuona earnings.
          </div>
        `;
        return;
      }

      cards.innerHTML = `
        <div class="wholesale-empty-state">
          Loading earnings...
        </div>
      `;

      try {
        const response = await fetch(
          `/api/orders/seller/${encodeURIComponent(sellerId)}/earnings`
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Imeshindikana kupata earnings."
          );
        }

        hideMessage();

        renderCards(data.summary || {});
        renderTransactions(
          Array.isArray(data.transactions)
            ? data.transactions
            : []
        );

        renderMonthly(
          Array.isArray(data.monthly)
            ? data.monthly
            : []
        );

      } catch (error) {
        console.error("Seller earnings error:", error);

        cards.innerHTML = `
          <div class="wholesale-empty-state">
            Imeshindikana kupakia earnings.
          </div>
        `;

        showMessage(
          error.message || "Imeshindikana kupata earnings.",
          true
        );
      }
    }

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        loadSellerEarnings
      );
    }

    loadSellerEarnings();

    window.refreshSellerEarnings = loadSellerEarnings;
  }


  /* ---------- SELLER DASHBOARD SECTIONS ---------- */
  
/* ============================================================
   ZENODIC SELLER APP - NAVIGATION / SINGLE VIEW MODE
   ============================================================ */


async function loadSellerAnalytics(period = "30d", customFrom = "", customTo = "") {
  const container = document.querySelector("#sellerAnalyticsContent");
  if (!container) return;

  const sellerId =
    window.currentUser?.id ||
    window.currentUser?.user_id ||
    window.sellerId ||
    2;

  const validPeriods = ["7d", "30d", "90d", "1y", "all"];

  if (!validPeriods.includes(period) && period !== "custom") {
    period = "30d";
  }

  const money = (amount, currency = "TZS") =>
    new Intl.NumberFormat("en-TZ", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(Number(amount || 0));

  const periodLabels = {
    "7d": "7 Days",
    "30d": "30 Days",
    "90d": "90 Days",
    "1y": "1 Year",
    "all": "All Time",
    "custom": "Custom Range"
  };

  const fromInput = document.querySelector("#sellerAnalyticsFrom");
  const toInput = document.querySelector("#sellerAnalyticsTo");

  try {
    container.innerHTML = `
      <div class="seller-analytics-loading">
        <span class="seller-speed-spinner"></span>
        <span>Loading Analytics...</span>
      </div>
    `;

    let url =
      `/api/orders/seller/${encodeURIComponent(sellerId)}/analytics`;

    if (customFrom && customTo) {
      url +=
        `?from=${encodeURIComponent(customFrom)}` +
        `&to=${encodeURIComponent(customTo)}`;
    } else {
      url += `?period=${encodeURIComponent(period)}`;
    }

    const topProductsUrl =
      `/api/orders/seller/${encodeURIComponent(sellerId)}/analytics/top-products` +
      (customFrom && customTo
        ? `?from=${encodeURIComponent(customFrom)}&to=${encodeURIComponent(customTo)}`
        : `?period=${encodeURIComponent(period)}`);

    const [response, topProductsResponse] = await Promise.all([
      fetch(url),
      fetch(topProductsUrl)
    ]);

    const data = await response.json();
    const topProductsData = await topProductsResponse.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kupakia Analytics."
      );
    }

    if (!topProductsResponse.ok || !topProductsData.success) {
      throw new Error(
        topProductsData.message || "Imeshindikana kupakia Top Products."
      );
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kupakia Analytics."
      );
    }

    const summary = data.summary || {};
    const status = Array.isArray(data.status) ? data.status : [];
    const daily = Array.isArray(data.daily) ? data.daily : [];
    const monthly = Array.isArray(data.monthly) ? data.monthly : [];
    const inventory = data.inventory || {};
    const topProducts = Array.isArray(topProductsData.products)
      ? topProductsData.products
      : [];

    const actualPeriod = data.period || period;
    const actualFrom = data.filters?.from || customFrom || "";
    const actualTo = data.filters?.to || customTo || "";

    if (fromInput) fromInput.value = actualFrom;
    if (toInput) toInput.value = actualTo;

    /* ----------------------------------------------------------
       SALES INSIGHTS
       ---------------------------------------------------------- */

    const totalSales = Number(summary.total_sales || 0);

    const bestDay = daily.reduce(
      (best, item) =>
        Number(item.sales || 0) > Number(best?.sales || 0)
          ? item
          : best,
      null
    );

    const averageDailySales = daily.length
      ? totalSales / daily.length
      : 0;

    const topProductTotalSales = topProducts.reduce(
      (total, product) => total + Number(product.sales || 0),
      0
    );

    const topProductsHtml = topProducts.length
      ? topProducts.map((product, index) => {
          const sales = Number(product.sales || 0);
          const quantity = Number(product.quantity || 0);
          const orders = Number(product.orders || 0);

          const share = topProductTotalSales > 0
            ? (sales / topProductTotalSales) * 100
            : 0;

          return `
            <div class="seller-analytics-product-row">
              <div class="seller-analytics-product-rank">
                ${index + 1}
              </div>

              <div class="seller-analytics-product-info">
                <strong>${product.product_name}</strong>

                <small>
                  ${quantity} units •
                  ${orders} order${orders === 1 ? "" : "s"}
                  • ${share.toFixed(1)}% of top-product sales
                </small>

                <div class="seller-analytics-product-progress">
                  <div
                    class="seller-analytics-product-progress-bar"
                    style="width:${Math.max(2, share)}%"
                  ></div>
                </div>
              </div>

              <b>${money(sales)}</b>
            </div>
          `;
        }).join("")
      : `
          <div class="seller-analytics-empty">
            Hakuna product sales kwa kipindi hiki.
          </div>
        `;

    const bestDayLabel = bestDay
      ? bestDay.date
      : "—";

    /* ----------------------------------------------------------
       ORDER STATUS
       ---------------------------------------------------------- */

    const statusLabels = {
      pending: "Pending",
      confirmed: "Confirmed",
      processing: "Processing",
      shipped: "Shipped",
      delivered: "Delivered",
      cancelled: "Cancelled"
    };

    const totalStatusOrders = status.reduce(
      (total, row) => total + Number(row.count || 0),
      0
    );

    const statusHtml = status.length
      ? status.map(row => {
          const statusName = statusLabels[row.status] || row.status;
          const count = Number(row.count || 0);
          const sales = Number(row.sales || 0);

          const percentage = totalStatusOrders
            ? Math.round((count / totalStatusOrders) * 100)
            : 0;

          return `
            <div class="seller-analytics-status-row">
              <div class="seller-analytics-status-main">
                <div class="seller-analytics-status-title">
                  <span>${statusName}</span>
                  <strong>${count}</strong>
                </div>

                <div class="seller-analytics-status-track">
                  <div
                    class="seller-analytics-status-progress"
                    style="width:${percentage}%"
                  ></div>
                </div>
              </div>

              <div class="seller-analytics-status-meta">
                <b>${percentage}%</b>
                <small>${money(sales)}</small>
              </div>
            </div>
          `;
        }).join("")
      : `
          <div class="seller-analytics-empty">
            Hakuna order data kwa kipindi hiki.
          </div>
        `;

    /* ----------------------------------------------------------
       SALES CHART
       ---------------------------------------------------------- */

    const maxDailySales = daily.reduce(
      (max, item) =>
        Math.max(max, Number(item.sales || 0)),
      0
    );

    const dailyHtml = daily.length
          ? daily.map(row => {
              const sales = Number(row.sales || 0);
              const orders = Number(row.orders || 0);

              const height = maxDailySales
                ? Math.max(4, (sales / maxDailySales) * 100)
                : 4;

              const shortDate = String(row.date || "")
                .slice(5)
                .replace("-", "/");

              return `
                <div
                  class="seller-analytics-chart-column"
                  title="${row.date}: ${money(sales)} • ${orders} order${orders === 1 ? "" : "s"}"
                  data-sales="${sales}"
                  data-orders="${orders}"
                >
                  <div
                    class="seller-analytics-chart-bar"
                    style="height:${height}%"
                  ></div>

                  <div class="seller-analytics-chart-tooltip">
                    <strong>${money(sales)}</strong>
                    <span>${orders} order${orders === 1 ? "" : "s"}</span>
                  </div>

                  <small>${shortDate}</small>
                </div>
              `;
            }).join("")
          : `
              <div class="seller-analytics-empty">
                Hakuna sales data kwa kipindi hiki.
              </div>
            `;

const monthlyHtml = monthly.length
      ? monthly.map(row => `
          <div class="seller-analytics-month-row">
            <span>${row.month}</span>
            <strong>${Number(row.orders || 0)} orders</strong>
            <b>${money(row.sales)}</b>
          </div>
        `).join("")
      : `
          <div class="seller-analytics-empty">
            Hakuna monthly data kwa kipindi hiki.
          </div>
        `;

    const titleLabel =
      periodLabels[actualPeriod] || "Custom Range";

    /* ----------------------------------------------------------
       RENDER
       ---------------------------------------------------------- */

    container.innerHTML = `
      <div class="seller-analytics-toolbar">
        <div>
          <span class="seller-analytics-kicker">
            BUSINESS INTELLIGENCE
          </span>

          <h2>Analytics</h2>

          <p>
            Chambua performance ya biashara yako kwa
            ${titleLabel.toLowerCase()}.
          </p>
        </div>

        <div class="seller-analytics-controls">
          <button
            type="button"
            class="seller-analytics-refresh"
            id="sellerAnalyticsRefreshBtn"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div class="seller-analytics-summary-grid">

        <article class="seller-analytics-card">
          <span>Total Orders</span>
          <strong>${Number(summary.total_orders || 0)}</strong>
          <small>
            Orders za ${titleLabel.toLowerCase()}
          </small>
        </article>

        <article class="seller-analytics-card">
          <span>Total Sales</span>
          <strong>${money(summary.total_sales)}</strong>
          <small>Sales zote</small>
        </article>

        <article class="seller-analytics-card">
          <span>Paid Sales</span>
          <strong>${money(summary.paid_sales)}</strong>
          <small>Malipo yaliyopokelewa</small>
        </article>

        <article class="seller-analytics-card">
          <span>Average Order</span>
          <strong>${money(summary.average_order_value)}</strong>
          <small>Average order value</small>
        </article>

      </div>

      <div class="seller-analytics-payment-health">
        <div class="seller-analytics-payment-head">
          <div>
            <span class="seller-analytics-kicker">PAYMENT HEALTH</span>
            <h2>Payment Overview</h2>
          </div>
          <strong>
            ${totalSales > 0
              ? Math.round((Number(summary.paid_sales || 0) / totalSales) * 100)
              : 0}%
          </strong>
        </div>

        <div class="seller-analytics-payment-track">
          <div
            class="seller-analytics-payment-paid"
            style="width:${
              totalSales > 0
                ? Math.min(
                    100,
                    (Number(summary.paid_sales || 0) / totalSales) * 100
                  )
                : 0
            }%"
          ></div>
        </div>

        <div class="seller-analytics-payment-grid">
          <div>
            <span>Paid</span>
            <strong>${money(summary.paid_sales)}</strong>
          </div>

          <div>
            <span>Unpaid</span>
            <strong>${money(summary.unpaid_sales)}</strong>
          </div>

          <div>
            <span>Total</span>
            <strong>${money(summary.total_sales)}</strong>
          </div>
        </div>
      </div>

      <div class="seller-analytics-insights">

        <article class="seller-analytics-insight-card">
          <span>Average Daily Sales</span>
          <strong>${money(averageDailySales)}</strong>
          <small>Kwa siku zilizopo kwenye data</small>
        </article>

        <article class="seller-analytics-insight-card">
          <span>Best Sales Day</span>
          <strong>${bestDayLabel}</strong>
          <small>
            ${bestDay ? money(bestDay.sales) : "Hakuna sales"}
          </small>
        </article>

      </div>

      <section class="seller-analytics-panel seller-analytics-wide">
  <div class="seller-analytics-panel-head">
    <div>
      <span class="seller-analytics-kicker">PRODUCT PERFORMANCE</span>
      <h2>Top Products</h2>
    </div>

    <span class="seller-analytics-count">
      Top ${Math.min(topProducts.length, 5)}
    </span>
  </div>

  <div class="seller-analytics-products">
    ${topProductsHtml}
  </div>
</section>

<div class="seller-analytics-layout">

        <section class="seller-analytics-panel seller-analytics-wide">

          <div class="seller-analytics-panel-head">
            <div>
              <span class="seller-analytics-kicker">
                SALES PERFORMANCE
              </span>

              <h2>Sales Trend</h2>
            </div>

            <span class="seller-analytics-count">
              ${daily.length} days
            </span>
          </div>

          <div class="seller-analytics-chart">
            ${dailyHtml}
          </div>

        </section>

        <section class="seller-analytics-panel">

          <div class="seller-analytics-panel-head">
            <div>
              <span class="seller-analytics-kicker">
                ORDER FLOW
              </span>

              <h2>Order Status</h2>
            </div>
          </div>

          <div class="seller-analytics-status">
            ${statusHtml}
          </div>

        </section>

        <section class="seller-analytics-panel">

          <div class="seller-analytics-panel-head">
            <div>
              <span class="seller-analytics-kicker">
                INVENTORY
              </span>

              <h2>Inventory Health</h2>
            </div>
          </div>

          <div class="seller-analytics-inventory-grid">

            <div>
              <span>Products</span>
              <strong>
                ${Number(inventory.total_products || 0)}
              </strong>
            </div>

            <div>
              <span>Total Quantity</span>
              <strong>
                ${Number(inventory.total_quantity || 0)}
              </strong>
            </div>

            <div>
              <span>Reserved</span>
              <strong>
                ${Number(inventory.reserved_quantity || 0)}
              </strong>
            </div>

            <div>
              <span>Attention</span>
              <strong>
                ${Number(
                  inventory.attention_products ||
                  inventory.attention_product_count ||
                  0
                )}
              </strong>
            </div>

          </div>

        </section>

        <section class="seller-analytics-panel seller-analytics-wide">

          <div class="seller-analytics-panel-head">
            <div>
              <span class="seller-analytics-kicker">
                HISTORY
              </span>

              <h2>Monthly Performance</h2>
            </div>
          </div>

          <div class="seller-analytics-monthly">
            ${monthlyHtml}
          </div>

        </section>

      </div>
    `;

    const refreshButton =
      container.querySelector("#sellerAnalyticsRefreshBtn");

    if (refreshButton) {
      refreshButton.addEventListener("click", () => {
        if (customFrom && customTo) {
          loadSellerAnalytics(
            "custom",
            customFrom,
            customTo
          );
        } else {
          loadSellerAnalytics(period);
        }
      });
    }

  } catch (error) {
    console.error(
      "Seller Analytics error:",
      error
    );

    container.innerHTML = `
      <div class="seller-analytics-error">

        <strong>
          Imeshindikana kupakia Analytics.
        </strong>

        <span>
          ${error.message || "Unknown error"}
        </span>

        <button
          type="button"
          class="seller-analytics-refresh"
          onclick="loadSellerAnalytics('${period}')"
        >
          Retry
        </button>

      </div>
    `;
  }
}

/* ============================================================
   SELLER ANALYTICS DATE FILTER WIRING
   ============================================================ */

function initSellerAnalyticsFilters() {
  const fromInput = document.querySelector("#sellerAnalyticsFrom");
  const toInput = document.querySelector("#sellerAnalyticsTo");
  const applyButton = document.querySelector("#sellerAnalyticsApplyBtn");
  const clearButton = document.querySelector("#sellerAnalyticsClearBtn");
  const message = document.querySelector("#sellerAnalyticsFilterMessage");
  const presets = document.querySelector("#sellerAnalyticsPresets");

  if (!fromInput || !toInput || !applyButton || !clearButton) {
    return;
  }

  applyButton.addEventListener("click", () => {
    const from = fromInput.value;
    const to = toInput.value;

    if (!from || !to) {
      if (message) {
        message.textContent = "Chagua From Date na To Date kwanza.";
      }
      return;
    }

    if (from > to) {
      if (message) {
        message.textContent =
          "From Date haiwezi kuwa baada ya To Date.";
      }
      return;
    }

    if (message) {
      message.textContent = `Inaonyesha analytics kutoka ${from} hadi ${to}.`;
    }

    loadSellerAnalytics("custom", from, to);
  });

  clearButton.addEventListener("click", () => {
    fromInput.value = "";
    toInput.value = "";

    if (message) {
      message.textContent = "";
    }

    loadSellerAnalytics("30d");
  });

  [fromInput, toInput].forEach(input => {
    input.addEventListener("change", () => {
      if (message) {
        message.textContent = "";
      }
    });
  });

  if (presets) {
    presets.querySelectorAll("[data-analytics-period]").forEach(button => {
      button.addEventListener("click", () => {
        const selectedPeriod = button.dataset.analyticsPeriod;

        if (!selectedPeriod) return;

        fromInput.value = "";
        toInput.value = "";

        if (message) {
          message.textContent = "";
        }

        loadSellerAnalytics(selectedPeriod);
      });
    });
  }
}

async function loadSellerSpeedSheet() {
  const container = document.querySelector(".seller-speed-sheet");
  if (!container) return;

  const sellerId =
    window.currentUser?.id ||
    window.currentUser?.user_id ||
    window.sellerId ||
    2;

  try {
    container.innerHTML = `
      <div class="seller-speed-sheet-loading">
        <span class="seller-speed-spinner"></span>
        <span>Loading Speed Sheet...</span>
      </div>
    `;

    const response = await fetch(
      `/api/orders/seller/${encodeURIComponent(sellerId)}/speed-sheet`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kupakia Speed Sheet.");
    }

    const money = (amount, currency = "TZS") =>
      new Intl.NumberFormat("en-TZ", {
        style: "currency",
        currency,
        maximumFractionDigits: 0
      }).format(Number(amount || 0));

    const today = data.today || {};
    const orders = data.orders || {};
    const payments = data.payments || {};
    const inventory = data.inventory || {};
    const recent = Array.isArray(data.recentOrders)
      ? data.recentOrders
      : [];
    const lowStock = Array.isArray(data.lowStock)
      ? data.lowStock
      : [];

    container.innerHTML = `
      <div class="seller-speed-sheet-top">
        <div>
          <span class="seller-speed-eyebrow">SELLER CONTROL CENTER</span>
          <h2>Speed Sheet</h2>
          <p>Muhtasari wa haraka wa biashara yako kwa wakati mmoja.</p>
        </div>

        <button type="button" class="seller-speed-refresh" id="sellerSpeedRefreshBtn">
          ↻ Refresh
        </button>
      </div>

      <div class="seller-speed-grid">

        <article class="seller-speed-card">
          <span class="seller-speed-label">Today's Sales</span>
          <strong>${money(today.sales)}</strong>
          <small>${Number(today.orders || 0)} orders today</small>
        </article>

        <article class="seller-speed-card">
          <span class="seller-speed-label">Paid Sales</span>
          <strong>${money(today.paid_sales)}</strong>
          <small>Collected today</small>
        </article>

        <article class="seller-speed-card">
          <span class="seller-speed-label">Unpaid Amount</span>
          <strong>${money(payments.unpaid_amount)}</strong>
          <small>${Number(payments.unpaid_orders || 0)} unpaid orders</small>
        </article>

        <article class="seller-speed-card">
          <span class="seller-speed-label">Inventory</span>
          <strong>${Number(inventory.total_quantity || 0)}</strong>
          <small>${Number(inventory.total_products || 0)} products</small>
        </article>

      </div>

      <div class="seller-speed-columns">

        <section class="seller-speed-panel">
          <div class="seller-speed-panel-head">
            <div>
              <span class="seller-speed-kicker">ORDER FLOW</span>
              <h3>Order Status</h3>
            </div>
          </div>

          <div class="seller-speed-status-grid">
            <div><b>${orders.pending || 0}</b><span>Pending</span></div>
            <div><b>${orders.confirmed || 0}</b><span>Confirmed</span></div>
            <div><b>${orders.processing || 0}</b><span>Processing</span></div>
            <div><b>${orders.shipped || 0}</b><span>Shipped</span></div>
            <div><b>${orders.delivered || 0}</b><span>Delivered</span></div>
            <div><b>${orders.cancelled || 0}</b><span>Cancelled</span></div>
          </div>
        </section>

        <section class="seller-speed-panel">
          <div class="seller-speed-panel-head">
            <div>
              <span class="seller-speed-kicker">PAYMENTS</span>
              <h3>Payment Health</h3>
            </div>
          </div>

          <div class="seller-speed-payment">
            <div>
              <span>Paid</span>
              <strong>${money(payments.paid_amount)}</strong>
            </div>
            <div>
              <span>Unpaid</span>
              <strong>${money(payments.unpaid_amount)}</strong>
            </div>
          </div>
        </section>

      </div>

      <section class="seller-speed-panel seller-speed-recent">
        <div class="seller-speed-panel-head">
          <div>
            <span class="seller-speed-kicker">LIVE ACTIVITY</span>
            <h3>Recent Orders</h3>
          </div>
          <span class="seller-speed-count">${recent.length}</span>
        </div>

        ${
          recent.length
            ? recent.map(order => `
              <div class="seller-speed-order">
                <div>
                  <strong>${escapeHtml(order.order_number || `Order #${order.id}`)}</strong>
                  <small>${escapeHtml(order.buyer_name || "Buyer")} · ${escapeHtml(order.expected_delivery || "—")}</small>
                </div>

                <span class="seller-speed-order-status status-${escapeHtml(
                  String(order.status || "").toLowerCase()
                )}">
                  ${escapeHtml(order.status || "unknown")}
                </span>

                <strong>${money(order.total_amount, order.currency || "TZS")}</strong>
              </div>
            `).join("")
            : `
              <div class="seller-speed-empty">
                Hakuna recent orders.
              </div>
            `
        }
      </section>

      <section class="seller-speed-panel seller-speed-alerts">
        <div class="seller-speed-panel-head">
          <div>
            <span class="seller-speed-kicker">INVENTORY WATCH</span>
            <h3>Stock Alerts</h3>
          </div>
        </div>

        ${
          lowStock.length
            ? lowStock.map(item => `
              <div class="seller-speed-alert">
                <strong>${escapeHtml(item.item_name || "Product")}</strong>
                <span>${Number(item.quantity || 0)} ${escapeHtml(item.unit || "pcs")} remaining</span>
              </div>
            `).join("")
            : `
              <div class="seller-speed-clear">
                ✓ Inventory iko salama — hakuna bidhaa low stock.
              </div>
            `
        }
      </section>
    `;

    const refresh = document.getElementById("sellerSpeedRefreshBtn");
    if (refresh) {
      refresh.addEventListener("click", loadSellerSpeedSheet);
    }

  } catch (error) {
    console.error("Seller Speed Sheet error:", error);

    container.innerHTML = `
      <div class="seller-speed-error">
        <strong>Speed Sheet haikupatikana.</strong>
        <p>${escapeHtml(error.message || "Unknown error")}</p>
        <button type="button" id="sellerSpeedRetryBtn">Retry</button>
      </div>
    `;

    const retry = document.getElementById("sellerSpeedRetryBtn");
    if (retry) {
      retry.addEventListener("click", loadSellerSpeedSheet);
    }
  }
}


/* ============================================================
   ZENODIC SELLER REPORTS
   ============================================================ */

async function loadSellerReports(period = "30d", customFrom = "", customTo = "") {
  const summary = document.querySelector("#sellerReportsSummary");
  const table = document.querySelector("#sellerReportsTable");
  const message = document.querySelector("#sellerReportsMessage");

  const fromInput = document.querySelector("#sellerReportFrom");
  const toInput = document.querySelector("#sellerReportTo");

  if (!customFrom && !customTo) {
    customFrom = fromInput?.value || "";
    customTo = toInput?.value || "";
  }

  const sellerId =
    window.currentUser?.id ||
    window.currentUser?.user_id ||
    window.sellerId ||
    2;

  const validPeriods = ["7d", "30d", "90d", "1y", "all"];

  if (!validPeriods.includes(period)) {
    period = "30d";
  }

  const money = (amount, currency = "TZS") =>
    new Intl.NumberFormat("en-TZ", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(Number(amount || 0));

  if (summary) {
    summary.innerHTML = `
      <div class="seller-compact-card">
        <div class="label">Total Orders</div>
        <div class="value">Loading...</div>
      </div>
      <div class="seller-compact-card">
        <div class="label">Total Sales</div>
        <div class="value">Loading...</div>
      </div>
      <div class="seller-compact-card">
        <div class="label">Paid Sales</div>
        <div class="value">Loading...</div>
      </div>
      <div class="seller-compact-card">
        <div class="label">Average Order</div>
        <div class="value">Loading...</div>
      </div>
    `;
  }

  if (table) {
    table.innerHTML =
      '<div class="wholesale-empty-state">Loading Reports...</div>';
  }

  if (message) {
    message.style.display = "none";
    message.textContent = "";
  }

  try {
    let reportUrl =
      `/api/orders/seller/${encodeURIComponent(sellerId)}/reports`;

    if (customFrom && customTo) {
      reportUrl +=
        `?from=${encodeURIComponent(customFrom)}` +
        `&to=${encodeURIComponent(customTo)}`;
    } else {
      reportUrl += `?period=${encodeURIComponent(period)}`;
    }

    const response = await fetch(reportUrl);

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || data.error || "Imeshindikana kupata seller report."
      );
    }

    const report = data.summary || {};
    const orders = Array.isArray(data.orders) ? data.orders : [];

    const currency =
      orders[0]?.currency ||
      "TZS";

    if (summary) {
      summary.innerHTML = `
        <div class="seller-compact-card">
          <div class="label">Total Orders</div>
          <div class="value">${Number(report.total_orders || 0).toLocaleString("en-TZ")}</div>
        </div>

        <div class="seller-compact-card">
          <div class="label">Total Sales</div>
          <div class="value">${money(report.total_sales, currency)}</div>
        </div>

        <div class="seller-compact-card">
          <div class="label">Paid Sales</div>
          <div class="value">${money(report.paid_sales, currency)}</div>
        </div>

        <div class="seller-compact-card">
          <div class="label">Average Order</div>
          <div class="value">${money(report.average_order_value, currency)}</div>
        </div>
      `;
    }

    if (!table) return;

    if (!orders.length) {
      table.innerHTML = `
        <div class="wholesale-empty-state">
          Hakuna orders zilizopatikana kwenye kipindi hiki.
        </div>
      `;
      return;
    }

    const rows = orders.map(order => `
      <tr>
        <td>
          <strong>${escapeHtml(order.order_number || ("#" + order.id))}</strong>
          <small>${escapeHtml(order.created_at || "")}</small>
        </td>

        <td>
          <strong>${escapeHtml(order.product_name || "—")}</strong>
          <small>
            ${Number(order.quantity || 0).toLocaleString("en-TZ")}
            ${escapeHtml(order.unit || "")}
          </small>
        </td>

        <td>${money(order.total_price ?? order.total_amount, order.currency || currency)}</td>

        <td>
          <span class="seller-report-status seller-report-status-${escapeHtml(
            String(order.payment_status || "unknown").toLowerCase()
          )}">
            ${escapeHtml(order.payment_status || "—")}
          </span>
        </td>

        <td>
          <span class="seller-report-status seller-report-status-${escapeHtml(
            String(order.status || "unknown").toLowerCase()
          )}">
            ${escapeHtml(order.status || "—")}
          </span>
        </td>

        <td>${escapeHtml(order.buyer_name || "—")}</td>
      </tr>
    `).join("");

    table.innerHTML = `
      <div class="seller-reports-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Product</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Buyer</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;

  } catch (error) {
    console.error("Seller Reports error:", error);

    if (summary) {
      summary.innerHTML = "";
    }

    if (table) {
      table.innerHTML = `
        <div class="seller-analytics-error">
          <strong>Imeshindikana kupakia Reports.</strong>
          <span>${escapeHtml(error.message || "Unknown error")}</span>
        </div>
      `;
    }

    if (message) {
      message.textContent =
        error.message || "Imeshindikana kupata seller report.";
      message.style.display = "block";
    }
  }
}

function initSellerReports() {
  const period = document.querySelector("#sellerReportPeriod");
  const refresh = document.querySelector("#sellerReportRefreshBtn");
  const excel = document.querySelector("#sellerReportExcelBtn");
  const fromInput = document.querySelector("#sellerReportFrom");
  const toInput = document.querySelector("#sellerReportTo");
  const apply = document.querySelector("#sellerReportApplyBtn");
  const clear = document.querySelector("#sellerReportClearBtn");

  if (apply && !apply.dataset.reportsBound) {
    apply.dataset.reportsBound = "1";

    apply.addEventListener("click", () => {
      const from = fromInput?.value || "";
      const to = toInput?.value || "";

      if (!from || !to) {
        alert("Chagua From Date na To Date kwanza.");
        return;
      }

      if (from > to) {
        alert("From Date haiwezi kuwa baada ya To Date.");
        return;
      }

      loadSellerReports("custom", from, to);
    });
  }

  if (clear && !clear.dataset.reportsBound) {
    clear.dataset.reportsBound = "1";

    clear.addEventListener("click", () => {
      if (fromInput) fromInput.value = "";
      if (toInput) toInput.value = "";

      loadSellerReports(period?.value || "30d");
    });
  }

  if (period && !period.dataset.reportsBound) {
    period.dataset.reportsBound = "1";

    period.addEventListener("change", () => {
      loadSellerReports(period.value);
    });
  }

  if (refresh && !refresh.dataset.reportsBound) {
    refresh.dataset.reportsBound = "1";

    refresh.addEventListener("click", () => {
      loadSellerReports(period?.value || "30d");
    });
  }

  if (excel && !excel.dataset.reportsBound) {
    excel.dataset.reportsBound = "1";

    excel.addEventListener("click", () => {
      const sellerId =
        window.currentUser?.id ||
        window.currentUser?.user_id ||
        window.sellerId ||
        2;

      const from = fromInput?.value || "";
      const to = toInput?.value || "";

      let excelUrl =
        `/api/orders/seller/${encodeURIComponent(sellerId)}/reports/excel`;

      if (from && to) {
        if (from > to) {
          alert("From Date haiwezi kuwa baada ya To Date.");
          return;
        }

        excelUrl +=
          `?from=${encodeURIComponent(from)}` +
          `&to=${encodeURIComponent(to)}`;
      } else {
        const selectedPeriod = period?.value || "30d";
        excelUrl += `?period=${encodeURIComponent(selectedPeriod)}`;
      }

      window.location.href = excelUrl;
    });
  }
}



/* ============================================================
   ZENODIC SELLER NOTIFICATIONS
   ============================================================ */

async function loadSellerNotifications() {
  const list = document.querySelector("#sellerNotificationsList");
  const badge = document.querySelector("#sellerNotificationBadge");
  const message = document.querySelector("#sellerNotificationsMessage");

  const sellerId =
    window.currentUser?.id ||
    window.currentUser?.user_id ||
    window.sellerId ||
    2;

  if (!list) return;

  list.innerHTML = `
    <div class="seller-notifications-loading">
      Loading notifications...
    </div>
  `;

  try {
    const response = await fetch(
      `/api/notifications/${encodeURIComponent(sellerId)}`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kupata notifications."
      );
    }

    const notifications = Array.isArray(data.notifications)
      ? data.notifications
      : [];

    const unread = Number(data.unread || 0);

    if (badge) {
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.classList.toggle("has-unread", unread > 0);
    }

    if (message) {
      message.style.display = "none";
      message.textContent = "";
    }

    if (!notifications.length) {
      list.innerHTML = `
        <div class="seller-notifications-empty">
          <div class="seller-notifications-empty-icon">🔔</div>
          <strong>No notifications yet</strong>
          <span>
            Notifications za orders, payments na updates zitaonekana hapa.
          </span>
        </div>
      `;
      return;
    }

    const iconFor = (type) => {
      switch (String(type || "").toLowerCase()) {
        case "payment":
          return "💳";
        case "order_status":
          return "📦";
        case "new_order":
          return "🛒";
        default:
          return "🔔";
      }
    };

    const formatDate = (value) => {
      if (!value) return "";

      const raw = String(value);
      const date = new Date(
        raw.includes("T") ? raw : raw.replace(" ", "T") + "Z"
      );

      if (Number.isNaN(date.getTime())) {
        return raw;
      }

      return new Intl.DateTimeFormat("en-TZ", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date);
    };

    const escape = (value) => {
      if (typeof escapeHtml === "function") {
        return escapeHtml(String(value ?? ""));
      }

      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    list.innerHTML = notifications.map((notification) => {
      const id = Number(notification.id);
      const isUnread = Number(notification.is_read) === 0;

      return `
        <article
          class="seller-notification-card ${isUnread ? "is-unread" : ""}"
          data-notification-id="${id}"
        >
          <div class="seller-notification-icon">
            ${iconFor(notification.type)}
          </div>

          <div class="seller-notification-content">
            <div class="seller-notification-top">
              <strong>
                ${escape(notification.title || "Notification")}
              </strong>

              ${
                isUnread
                  ? '<span class="seller-notification-new">NEW</span>'
                  : ""
              }
            </div>

            <p>
              ${escape(notification.message || "")}
            </p>

            <small>
              ${escape(formatDate(notification.created_at))}
            </small>
          </div>

          <div class="seller-notification-actions">
            ${
              isUnread
                ? `
                  <button
                    type="button"
                    class="seller-notification-read-btn"
                    data-notification-read="${id}"
                  >
                    Mark read
                  </button>
                `
                : `
                  <span class="seller-notification-read-label">
                    Read
                  </span>
                `
            }
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-notification-read]").forEach((button) => {
      button.addEventListener("click", async () => {
        const notificationId = Number(
          button.getAttribute("data-notification-read")
        );

        if (Number.isInteger(notificationId) && notificationId > 0) {
          await markSellerNotificationRead(notificationId);
        }
      });
    });

  } catch (error) {
    console.error("Seller notifications error:", error);

    list.innerHTML = `
      <div class="seller-analytics-error">
        <strong>Imeshindikana kupakia Notifications.</strong>
        <span>${typeof escapeHtml === "function"
          ? escapeHtml(error.message || "Unknown error")
          : String(error.message || "Unknown error")}
        </span>
      </div>
    `;

    if (message) {
      message.textContent =
        error.message || "Imeshindikana kupata notifications.";
      message.style.display = "block";
    }
  }
}

async function markSellerNotificationRead(notificationId) {
  const sellerId =
    window.currentUser?.id ||
    window.currentUser?.user_id ||
    window.sellerId ||
    2;

  try {
    const response = await fetch(
      `/api/notifications/${encodeURIComponent(notificationId)}/read`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: sellerId
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kusoma notification."
      );
    }

    await loadSellerNotifications();

  } catch (error) {
    console.error("Mark notification read error:", error);
    alert(error.message || "Imeshindikana kusoma notification.");
  }
}


async function markAllSellerNotificationsRead() {
  const sellerId =
    window.currentUser?.id ||
    window.currentUser?.user_id ||
    window.sellerId ||
    2;

  try {
    const response = await fetch(
      "/api/notifications/read-all",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: sellerId
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kusoma notifications."
      );
    }

    await loadSellerNotifications();

  } catch (error) {
    console.error("Mark all notifications error:", error);
    alert(error.message || "Imeshindikana kusoma notifications.");
  }
}


function initSellerNotifications() {
  const readAll = document.querySelector(
    "#sellerNotificationsReadAllBtn"
  );

  if (readAll && !readAll.dataset.notificationsBound) {
    readAll.dataset.notificationsBound = "1";

    readAll.addEventListener(
      "click",
      markAllSellerNotificationsRead
    );
  }

  loadSellerNotifications();
}

function setupSellerAppNavigation() {
  const dashboard = document.getElementById("sellerDashboard");
  if (!dashboard) return;

  const sidebar = document.getElementById("sellerAppSidebar");
  const overlay = document.getElementById("sellerAppOverlay");
  const menuBtn = document.getElementById("sellerAppMenuBtn");
  const navButtons = dashboard.querySelectorAll("[data-seller-nav]");
  const views = dashboard.querySelectorAll("[data-seller-page]");

  function closeMenu() {
    if (sidebar) sidebar.classList.remove("open");

    if (overlay) {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
    }

    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "false");
    }
  }

  function openMenu() {
    if (sidebar) sidebar.classList.add("open");

    if (overlay) {
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
    }

    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "true");
    }
  }

  function activate(name) {
    if (name === "ai") {
      closeMenu();
      show("sellerAI");
      return;
    }

    navButtons.forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.sellerNav === name
      );
    });
      views.forEach(view => {
        const isActive = view.dataset.sellerPage === name;

        view.classList.toggle("active", isActive);
        view.style.display = isActive ? "block" : "none";
      });

    closeMenu();
    if (name === "buyer-orders" || name === "orders") {
      if (typeof window.refreshSellerOrders === "function") {
        window.refreshSellerOrders();
      }
    }

    if (name === "earnings") {
      if (typeof loadSellerEarnings === "function") {
        loadSellerEarnings();
      }
    }

    if (name === "payments") {
      if (typeof initSellerPayments === "function") {
        initSellerPayments();
      }

      if (typeof loadSellerPayments === "function") {
        loadSellerPayments();
      }
    }

    if (name === "speed-sheet") {
      if (typeof loadSellerSpeedSheet === "function") {
        loadSellerSpeedSheet();
      }
    }

    if (name === "analytics") {
      loadSellerAnalytics();
    }

    if (name === "settings") {
      if (typeof initSellerSettings === "function") {
        initSellerSettings();
      }
      if (typeof loadSellerSettings === "function") {
        loadSellerSettings();
      }
      if (typeof initSellerPasswordToggles === "function") {
        initSellerPasswordToggles();
      }
    }

    if (name === "reports") {
      if (typeof initSellerReports === "function") {
        initSellerReports();
      }

      if (typeof loadSellerReports === "function") {
        const period = document.querySelector("#sellerReportPeriod");
        loadSellerReports(period?.value || "30d");
      }
    }
  }

  navButtons.forEach(button => {
    button.addEventListener("click", () => {
      const name = button.dataset.sellerNav;
      if (name) activate(name);
    });
  });

  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      if (sidebar && sidebar.classList.contains("open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener("click", closeMenu);
  }

  activate("dashboard");

  // Initialize Analytics date/preset filters once.
  if (typeof initSellerAnalyticsFilters === "function") {
    initSellerAnalyticsFilters();
  }
}

function setupSellerAppPages() {
  const modern = document.getElementById("modernSellerDashboard");
  if (!modern) return;

  // Orders and Earnings pages already exist in index.html.
  // Do not create duplicate dynamic pages here.
}

function setupSellerSections() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-seller-section]");
      if (!button) return;

      const sectionId = button.dataset.sellerSection;
      if (!sectionId) return;

      const section = document.getElementById(sectionId);
      if (!section) {
        console.warn("Seller section not found:", sectionId);
        return;
      }

      document.querySelectorAll(".page").forEach((page) => {
        page.style.display = "none";
      });

      section.style.display = "block";

      if (sectionId === "sellerEarningsPanel") {
        if (typeof window.refreshSellerEarnings === "function") {
          window.refreshSellerEarnings();
        }
      }

      section.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  
/* ---------- SELLER SETTINGS ---------- */
async function loadSellerSettings() {
  const form = document.getElementById("sellerSettingsForm");
  if (!form) return;

  try {
    const savedUser = localStorage.getItem("zenodic_user");
    if (!savedUser) return;

    const user = JSON.parse(savedUser);
    const userId = Number(user?.id);

    if (!userId) return;

    const response = await fetch(`${API_BASE}/api/seller/settings?user_id=${userId}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kupakia settings.");
    }

    const settings = data.settings || {};

      const loginStatusBox =
        document.getElementById("sellerLoginStatus");

      if (loginStatusBox) {
        loginStatusBox.textContent = "Active session";
      }

      const lastLoginBox =
        document.getElementById("sellerLastLogin");

      if (lastLoginBox) {
        if (data.user?.last_login_at) {
          const date = new Date(
            String(data.user.last_login_at).replace(" ", "T") + "Z"
          );

          lastLoginBox.textContent = Number.isNaN(date.getTime())
            ? data.seller.last_login_at
            : date.toLocaleString();
        } else {
          lastLoginBox.textContent = "No login recorded yet";
        }
      }


      const lastUpdateBox =
        document.getElementById("sellerSecurityLastUpdate");

      if (lastUpdateBox) {
        if (settings.updated_at) {
          const date = new Date(
            String(settings.updated_at).replace(" ", "T") + "Z"
          );

          lastUpdateBox.textContent = Number.isNaN(date.getTime())
            ? settings.updated_at
            : date.toLocaleString();
        } else {
          lastUpdateBox.textContent = "Not available";
        }
      }


    document.getElementById("sellerStoreName").value =
      settings.store_name || "";

    document.getElementById("sellerPhone").value =
      settings.phone || "";

    document.getElementById("sellerLocation").value =
      settings.location || "";

    document.getElementById("sellerDescription").value =
      settings.description || "";

    document.getElementById("sellerStoreStatus").value =
      settings.store_status || "open";

    document.getElementById("sellerCurrency").value =
      settings.currency || "TZS";

    document.getElementById("sellerMinimumOrderQuantity").value =
      settings.minimum_order_quantity ?? 1;

    document.getElementById("sellerDeliveryInformation").value =
      settings.delivery_information || "";

    /* ---------- PAYMENT & PAYOUT ---------- */
    const payoutMethod = document.getElementById("sellerPayoutMethod");
    const payoutName = document.getElementById("sellerPayoutName");
    const payoutAccount = document.getElementById("sellerPayoutAccount");
    const payoutSchedule = document.getElementById("sellerPayoutSchedule");
    const taxNumber = document.getElementById("sellerTaxNumber");

    if (payoutMethod) {
      payoutMethod.value = settings.payout_method || "mobile_money";
    }

    if (payoutName) {
      payoutName.value = settings.payout_account_name || "";
    }

    if (payoutAccount) {
      payoutAccount.value = settings.payout_account_number || "";
    }

    if (payoutSchedule) {
      payoutSchedule.value = settings.payout_schedule || "monthly";
    }

    if (taxNumber) {
      taxNumber.value = settings.tax_vat_number || "";
    }

    /* ---------- NOTIFICATION PREFERENCES ---------- */
    const notifyNewOrders =
      document.getElementById("sellerNotifyNewOrders");

    const notifyRfqs =
      document.getElementById("sellerNotifyRfqs");

    const notifyOrderUpdates =
      document.getElementById("sellerNotifyOrderUpdates");

    const notifyMarketing =
      document.getElementById("sellerNotifyMarketing");

    if (notifyNewOrders) {
      notifyNewOrders.checked = Number(settings.notify_new_orders) === 1;
    }

    if (notifyRfqs) {
      notifyRfqs.checked = Number(settings.notify_rfqs) === 1;
    }

    if (notifyOrderUpdates) {
      notifyOrderUpdates.checked =
        Number(settings.notify_order_updates) === 1;
    }

    if (notifyMarketing) {
      notifyMarketing.checked =
        Number(settings.notify_marketing) === 1;
    }

    console.log("Seller settings zimepakiwa.");
  } catch (error) {
    console.error("Load seller settings error:", error);
  }
}


async function saveSellerSettings(event) {
  event.preventDefault();

  const form = document.getElementById("sellerSettingsForm");
  const messageBox = document.getElementById("sellerSettingsMessage");

  if (!form) return;

  try {
    const savedUser = localStorage.getItem("zenodic_user");
    if (!savedUser) {
      throw new Error("Seller account haijaingia.");
    }

    const user = JSON.parse(savedUser);
    const userId = Number(user?.id);

    if (!userId) {
      throw new Error("Seller user ID haijapatikana.");
    }

    const payload = {
      user_id: userId,
      store_name: document.getElementById("sellerStoreName")?.value.trim() || "",
      phone: document.getElementById("sellerPhone")?.value.trim() || "",
      location: document.getElementById("sellerLocation")?.value.trim() || "",
      description: document.getElementById("sellerDescription")?.value.trim() || "",
      store_status: document.getElementById("sellerStoreStatus")?.value || "open",
      currency: document.getElementById("sellerCurrency")?.value.trim() || "TZS",
      minimum_order_quantity:
        Number(document.getElementById("sellerMinimumOrderQuantity")?.value) || 1,
      delivery_information:
        document.getElementById("sellerDeliveryInformation")?.value.trim() || ""
    };

    const response = await fetch(API_BASE + "/api/seller/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kuhifadhi settings.");
    }

    if (messageBox) {
      messageBox.textContent = data.message || "Settings zimehifadhiwa.";
      messageBox.style.display = "block";
    }

    console.log("Seller settings zimehifadhiwa.");
  } catch (error) {
    console.error("Save seller settings error:", error);

    if (messageBox) {
      messageBox.textContent =
        error.message || "Imeshindikana kuhifadhi settings.";
      messageBox.style.display = "block";
    }
  }
}


async function saveSellerPayoutSettings() {
  const user = JSON.parse(localStorage.getItem("zenodic_user") || "null");
  const message = document.getElementById("sellerPayoutMessage");

  if (!user?.id) {
    if (message) {
      message.textContent = "Seller account haijapatikana.";
      message.style.display = "block";
    }
    return;
  }

  const payoutMethod =
    document.getElementById("sellerPayoutMethod")?.value || "mobile_money";

  const payoutName =
    document.getElementById("sellerPayoutName")?.value.trim() || "";

  const payoutAccount =
    document.getElementById("sellerPayoutAccount")?.value.trim() || "";

  const payoutSchedule =
    document.getElementById("sellerPayoutSchedule")?.value || "monthly";

  const taxNumber =
    document.getElementById("sellerTaxNumber")?.value.trim() || "";

  if (!payoutName || !payoutAccount) {
    if (message) {
      message.textContent = "Weka account holder name na account/phone number.";
      message.style.display = "block";
    }
    return;
  }

  try {
    const response = await fetch(API_BASE + "/api/seller/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: user.id,
        payout_method: payoutMethod,
        payout_account_name: payoutName,
        payout_account_number: payoutAccount,
        payout_schedule: payoutSchedule,
        tax_vat_number: taxNumber
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kuhifadhi payout settings.");
    }

    if (message) {
      message.textContent = "✓ Payout settings zimehifadhiwa.";
      message.style.display = "block";
    }

  } catch (error) {
    console.error("Save payout settings error:", error);

    if (message) {
      message.textContent =
        error.message || "Kuna tatizo kuhifadhi payout settings.";
      message.style.display = "block";
    }
  }
}

async function saveSellerNotificationSettings() {
  const user = JSON.parse(
    localStorage.getItem("zenodic_user") || "null"
  );

  const message =
    document.getElementById("sellerNotificationMessage");

  if (!user?.id) {
    if (message) {
      message.textContent = "Seller account haijapatikana.";
      message.style.display = "block";
    }
    return;
  }

  const payload = {
    user_id: user.id,
    notify_new_orders:
      document.getElementById("sellerNotifyNewOrders")?.checked ? 1 : 0,
    notify_rfqs:
      document.getElementById("sellerNotifyRfqs")?.checked ? 1 : 0,
    notify_order_updates:
      document.getElementById("sellerNotifyOrderUpdates")?.checked ? 1 : 0,
    notify_marketing:
      document.getElementById("sellerNotifyMarketing")?.checked ? 1 : 0
  };

  try {
    const response = await fetch(API_BASE + "/api/seller/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        "Imeshindikana kuhifadhi notification settings."
      );
    }

    if (message) {
      message.textContent =
        "✓ Notification settings zimehifadhiwa.";
      message.style.display = "block";
    }

  } catch (error) {
    console.error(
      "Save notification settings error:",
      error
    );

    if (message) {
      message.textContent =
        error.message ||
        "Kuna tatizo kuhifadhi notification settings.";
      message.style.display = "block";
    }
  }
}

function initSellerNotificationSettings() {
  const button =
    document.getElementById("saveSellerNotificationsBtn");

  if (button && !button.dataset.notificationBound) {
    button.dataset.notificationBound = "1";

    button.addEventListener(
      "click",
      saveSellerNotificationSettings
    );
  }
}

function initSellerPayoutSettings() {
  const button = document.getElementById("saveSellerPayoutBtn");

  if (button && !button.dataset.payoutBound) {
    button.dataset.payoutBound = "1";
    button.addEventListener("click", saveSellerPayoutSettings);
  }
}


function formatSellerLoginDevice(userAgent) {
  const ua = String(userAgent || "").toLowerCase();

  let browser = "Unknown browser";
  let device = "Desktop";

  if (ua.includes("edg/")) {
    browser = "Edge";
  } else if (ua.includes("chrome/") && !ua.includes("edg/")) {
    browser = "Chrome";
  } else if (ua.includes("firefox/")) {
    browser = "Firefox";
  } else if (ua.includes("safari/") && !ua.includes("chrome/")) {
    browser = "Safari";
  }

  if (
    ua.includes("android") ||
    ua.includes("iphone") ||
    ua.includes("ipad")
  ) {
    device = ua.includes("ipad")
      ? "Tablet"
      : "Mobile";
  }

  let os = "";

  if (ua.includes("android")) {
    os = "Android";
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    os = "iOS";
  } else if (ua.includes("windows")) {
    os = "Windows";
  } else if (ua.includes("mac os")) {
    os = "macOS";
  } else if (ua.includes("linux")) {
    os = "Linux";
  }

  return {
    browser,
    device,
    os
  };
}

function formatSellerLoginIp(ip) {
  const value = String(ip || "").trim();

  if (!value) {
    return "IP unavailable";
  }

  if (value.includes(":")) {
    const parts = value.split(":").filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0]}:****:****`;
    }

    return "IPv6 hidden";
  }

  const parts = value.split(".");

  if (parts.length === 4) {
    return `${parts[0]}.***.***.${parts[3]}`;
  }

  return "IP hidden";
}

function updateSellerLoginStatus() {
  const statusBox =
    document.getElementById("sellerLoginStatus");

  if (!statusBox) return;

  try {
    const user = JSON.parse(
      localStorage.getItem("zenodic_user") || "null"
    );

    if (user?.id) {
      statusBox.textContent = "Active session";
    } else {
      statusBox.textContent = "Session unavailable";
    }
  } catch (error) {
    console.error("Seller login status error:", error);
    statusBox.textContent = "Session unavailable";
  }
}


async function clearSellerLoginHistory() {
  const button = document.getElementById(
    "clearSellerLoginHistoryBtn"
  );

  if (!button) return;

  const confirmed = window.confirm(
    "Unataka kufuta login history yote ya seller account hii?"
  );

  if (!confirmed) return;

  try {
    const user = JSON.parse(
      localStorage.getItem("zenodic_user") || "null"
    );

    const userId = Number(user?.id);

    if (!userId) {
      alert("Seller account haijapatikana.");
      return;
    }

    button.disabled = true;
    button.textContent = "Clearing...";

    const response = await fetch(
      `/api/seller/login-activity?user_id=${userId}`,
      {
        method: "DELETE"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        "Imeshindikana kufuta login history."
      );
    }

    const historyBox =
      document.getElementById("sellerLoginHistory");

    if (historyBox) {
      historyBox.innerHTML =
        '<div class="seller-login-history-empty">No login activity recorded yet.</div>';
    }

    button.innerHTML = `<svg class="seller-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16"></path>
      <path d="M9 7V4h6v3"></path>
      <path d="M7 7l1 14h8l1-14"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    </svg><span>Clear history</span>`;

  } catch (error) {
    console.error(
      "Clear seller login history error:",
      error
    );

    alert(
      error.message ||
      "Imeshindikana kufuta login history."
    );

    button.innerHTML = `<svg class="seller-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16"></path>
      <path d="M9 7V4h6v3"></path>
      <path d="M7 7l1 14h8l1-14"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    </svg><span>Clear history</span>`;
  } finally {
    button.disabled = false;
  }
}

function initSellerClearLoginHistory() {
  if (window.__sellerClearLoginHistoryBound) return;

  window.__sellerClearLoginHistoryBound = true;

  document.addEventListener("click", function(event) {
    const button = event.target.closest(
      "#clearSellerLoginHistoryBtn"
    );

    if (!button) return;

    event.preventDefault();

    clearSellerLoginHistory();
  });
}

async function loadSellerLoginActivity() {
  const historyBox =
    document.getElementById("sellerLoginHistory");

  if (!historyBox) return;

  updateSellerLoginStatus();

  try {
    const user = JSON.parse(
      localStorage.getItem("zenodic_user") || "null"
    );

    const userId = Number(user?.id);

    if (!userId) {
      historyBox.innerHTML =
        '<div class="seller-login-history-empty">Seller account haijapatikana.</div>';
      return;
    }

    const response = await fetch(
      `/api/seller/login-activity?user_id=${userId}`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
        "Imeshindikana kupakia login activity."
      );
    }

    const activities = Array.isArray(data.activities)
      ? data.activities
      : [];

    if (!activities.length) {
      historyBox.innerHTML =
        '<div class="seller-login-history-empty">No login activity recorded yet.</div>';
      return;
    }

    historyBox.innerHTML = activities.map(activity => {
      const date = activity.login_at
        ? new Date(
            String(activity.login_at).replace(" ", "T") + "Z"
          )
        : null;

      const loginTime =
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleString()
          : (activity.login_at || "Unknown time");

      const deviceInfo =
        formatSellerLoginDevice(activity.device_info);

      const deviceIcon =
        deviceInfo.device === "Mobile"
          ? `<svg class="seller-device-svg" viewBox="0 0 24 24" aria-label="Mobile">
              <rect x="7" y="2.5" width="10" height="19" rx="2"></rect>
              <path d="M10 5h4"></path>
              <circle cx="12" cy="18.5" r="0.8"></circle>
            </svg>`
          : deviceInfo.device === "Tablet"
            ? `<svg class="seller-device-svg" viewBox="0 0 24 24" aria-label="Tablet">
                <rect x="5" y="2.5" width="14" height="19" rx="2"></rect>
                <circle cx="12" cy="18.5" r="0.8"></circle>
              </svg>`
            : `<svg class="seller-device-svg" viewBox="0 0 24 24" aria-label="Desktop">
                <rect x="3" y="4" width="18" height="13" rx="2"></rect>
                <path d="M8 21h8"></path>
                <path d="M12 17v4"></path>
              </svg>`;

      const browserIcon =
        deviceInfo.browser === "Chrome"
          ? `<svg class="seller-browser-icon chrome-icon" viewBox="0 0 24 24" aria-label="Chrome">
              <circle cx="12" cy="12" r="9" fill="#fbbc04"></circle>
              <path d="M12 12L4.2 7.5A9 9 0 0 1 20.8 9H12Z" fill="#ea4335"></path>
              <path d="M12 12L20.8 9A9 9 0 0 1 8.1 20L12 12Z" fill="#34a853"></path>
              <circle cx="12" cy="12" r="4" fill="#4285f4"></circle>
              <circle cx="12" cy="12" r="2.8" fill="#5b9df9"></circle>
            </svg>`
          : deviceInfo.browser === "Edge"
            ? `<svg class="seller-browser-icon edge-icon" viewBox="0 0 24 24" aria-label="Edge">
                <defs>
                  <linearGradient id="edgeGradient" x1="4" y1="20" x2="20" y2="4">
                    <stop offset="0" stop-color="#0c7cdb"></stop>
                    <stop offset="0.5" stop-color="#12b8a6"></stop>
                    <stop offset="1" stop-color="#35c96f"></stop>
                  </linearGradient>
                </defs>
                <path fill="url(#edgeGradient)" d="M20.6 14.1c-.8 3.5-4 6-7.8 6-4.8 0-8.7-3.7-8.7-8.4 0-4.4 3.4-8 7.8-8.5-2.5 1-4.1 3.2-4.1 5.9 0 3.4 2.8 6 6.3 6h6.5c.1-.3.1-.7 0-1z"></path>
                <path fill="#087fdb" d="M20.8 13.5c-.5-4.4-4.2-7.8-8.7-7.8-2.1 0-4 .7-5.5 1.9 1.2-.3 2.5-.1 3.6.5 1.4.7 2.4 1.9 2.8 3.4h7.8z"></path>
              </svg>`
            : deviceInfo.browser === "Firefox"
              ? `<svg class="seller-browser-icon firefox-icon" viewBox="0 0 24 24" aria-label="Firefox">
                  <defs>
                    <linearGradient id="firefoxGradient" x1="5" y1="19" x2="19" y2="5">
                      <stop offset="0" stop-color="#ff6a00"></stop>
                      <stop offset="0.55" stop-color="#ff3d81"></stop>
                      <stop offset="1" stop-color="#9b3cff"></stop>
                    </linearGradient>
                  </defs>
                  <path fill="url(#firefoxGradient)" d="M18.9 7.2c-.4-1.4-1.3-2.6-2.5-3.5.1.8-.1 1.5-.6 2.1-1.2-.9-2.7-1.4-4.3-1.4.5.5.8 1 .9 1.6-2.9.2-5.3 2-6.3 4.6-.5 1.3-.5 2.8-.1 4.1.3-.9.9-1.7 1.6-2.2 0 2.7 1.9 5 4.6 5.5 3.3.6 6.6-1.3 7.6-4.4.5-1.7.3-3.4-.3-4.8.7.3 1.3.8 1.8 1.4.1-1.1-.2-2.2-.8-3z"></path>
                  <path fill="#ffb300" d="M7.8 8.8c1.2-1.1 2.9-1.8 4.7-1.8 3.8 0 6.8 3 6.8 6.8 0 .7-.1 1.4-.3 2.1-1.1 2.4-3.5 4-6.2 4-3.8 0-6.8-3-6.8-6.8 0-1.5.5-3 1.3-4.3.1 0 .3 0 .5 0z"></path>
                </svg>`
              : deviceInfo.browser === "Safari"
                ? `<svg class="seller-browser-icon safari-icon" viewBox="0 0 24 24" aria-label="Safari">
                    <circle cx="12" cy="12" r="9" fill="#eef6ff"></circle>
                    <circle cx="12" cy="12" r="9" fill="none" stroke="#1683d8" stroke-width="1.5"></circle>
                    <path d="M15.8 8.2L13.1 13.1L8.2 15.8L10.9 10.9L15.8 8.2Z" fill="#1683d8"></path>
                    <path d="M15.8 8.2L13.1 13.1" stroke="#e53935" stroke-width="1.2" stroke-linecap="round"></path>
                  </svg>`
                : `<svg class="seller-browser-icon unknown-browser-icon" viewBox="0 0 24 24" aria-label="Browser">
                    <circle cx="12" cy="12" r="9" fill="#e9ecef"></circle>
                    <path d="M3 12h18M12 3c2.2 2.5 3.2 5.5 3.2 9S14.2 18.5 12 21c-2.2-2.5-3.2-5.5-3.2-9S9.8 5.5 12 3z" fill="none" stroke="#6c757d" stroke-width="1.4"></path>
                  </svg>`;

      const readableDevice = [
        deviceInfo.os
      ].filter(Boolean).join(" · ");

      const readableIp =
        formatSellerLoginIp(activity.ip_address);

      const loginStatus =
        String(activity.login_status || "success").toLowerCase();

      const isSuccess =
        loginStatus === "success";

      const statusLabel =
        isSuccess ? "SUCCESS" : "FAILED";

      const statusIcon =
        isSuccess
        ? `<svg class="seller-status-icon success" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle></svg>`
        : `<svg class="seller-status-icon failed" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle></svg>`;

      const activityTitle =
        isSuccess
          ? "Successful login"
          : "Failed login attempt";

      return `
        <div class="seller-login-history-item">
          <div>
            <strong>${activityTitle}</strong>
            <small>${loginTime}</small>
            <small class="seller-login-ip-line">
              <svg class="seller-ip-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M3 12h18"></path>
                <path d="M12 3c2.2 2.5 3.2 5.5 3.2 9S14.2 18.5 12 21c-2.2-2.5-3.2-5.5-3.2-9S9.8 5.5 12 3z"></path>
              </svg>
              <span>IP: ${readableIp}</span>
            </small>
          </div>

          <div>
            <small class="seller-login-device-line">
              <span class="seller-device-icon">${deviceIcon}</span>
              ${browserIcon}
              <span>${deviceInfo.browser} · ${readableDevice}</span>
            </small>
            <small>${statusIcon} ${statusLabel}</small>
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error(
      "Load seller login activity error:",
      error
    );

    historyBox.innerHTML =
      '<div class="seller-login-history-empty">Imeshindikana kupakia login activity.</div>';
  }
}

function initSellerAccountSecurity() {
  const emailBox = document.getElementById("sellerSecurityEmail");

  if (!emailBox) return;

  try {
    const user = JSON.parse(
      localStorage.getItem("zenodic_user") || "null"
    );

    emailBox.textContent = user?.email || "Email not available";
  } catch (error) {
    console.error("Seller account security error:", error);
    emailBox.textContent = "Email not available";
  }
}

function initSellerSettings() {
  const form = document.getElementById("sellerSettingsForm");

  if (form && !form.dataset.settingsBound) {
    form.dataset.settingsBound = "1";
    form.addEventListener("submit", saveSellerSettings);
  }

  if (typeof initSellerChangePassword === "function") {
    initSellerChangePassword();
  }

  if (typeof initSellerPasswordToggles === "function") {
    initSellerPasswordToggles();
  }

  if (typeof initSellerPayoutSettings === "function") {
    initSellerPayoutSettings();
  }

  if (typeof initSellerNotificationSettings === "function") {
    initSellerNotificationSettings();
  }

  if (typeof initSellerAccountSecurity === "function") {
    initSellerAccountSecurity();
  }

  if (typeof initSellerClearLoginHistory === "function") {
    initSellerClearLoginHistory();
  }

  if (typeof loadSellerLoginActivity === "function") {
    loadSellerLoginActivity();
  }
}

async function changeSellerPassword(event) {
  event.preventDefault();

  const form = document.getElementById("sellerChangePasswordForm");
  const messageBox = document.getElementById("sellerChangePasswordMessage");

  if (!form) return;

  const currentPassword =
    document.getElementById("sellerCurrentPassword")?.value || "";

  const newPassword =
    document.getElementById("sellerNewPassword")?.value || "";

  const confirmPassword =
    document.getElementById("sellerConfirmPassword")?.value || "";

  if (newPassword !== confirmPassword) {
    if (messageBox) {
      messageBox.textContent = "New passwords hazifanani.";
      messageBox.style.display = "block";
    }
    return;
  }

  try {
    const savedUser = localStorage.getItem("zenodic_user");
    const user = savedUser ? JSON.parse(savedUser) : null;
    const userId = Number(user?.id);

    if (!userId) {
      throw new Error("Seller user ID haijapatikana.");
    }

    const response = await fetch(API_BASE + "/api/seller/change-password", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: userId,
        current_password: currentPassword,
        new_password: newPassword
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kubadilisha password."
      );
    }

    form.reset();

    if (messageBox) {
      messageBox.textContent =
        data.message || "Password imebadilishwa vizuri.";
      messageBox.style.display = "block";
    }
  } catch (error) {
    console.error("Change seller password error:", error);

    if (messageBox) {
      messageBox.textContent =
        error.message || "Imeshindikana kubadilisha password.";
      messageBox.style.display = "block";
    }
  }
}

function initSellerChangePassword() {
  const form = document.getElementById("sellerChangePasswordForm");

  if (!form || form.dataset.passwordBound) return;

  form.dataset.passwordBound = "1";
  form.addEventListener("submit", changeSellerPassword);
}


/* ---------- SELLER PASSWORD VISIBILITY ---------- */
function initSellerPasswordToggles() {
  const buttons = document.querySelectorAll(".seller-password-toggle");

  buttons.forEach((button) => {
    if (button.dataset.passwordToggleBound) return;

    button.dataset.passwordToggleBound = "1";

    button.addEventListener("click", () => {
      const targetId = button.dataset.passwordTarget;
      const input = document.getElementById(targetId);

      if (!input) return;

      const showing = input.type === "text";

      input.type = showing ? "password" : "text";
      button.innerHTML = showing
        ? `<svg class="password-eye-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"></path>
            <circle cx="12" cy="12" r="2.5"></circle>
          </svg>`
        : `<svg class="password-eye-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3l18 18"></path>
            <path d="M10.6 5.2C11.1 5.1 11.5 5 12 5c6 0 9.5 7 9.5 7a16.8 16.8 0 0 1-3.1 3.9"></path>
            <path d="M6.1 6.1C3.8 8 2.5 12 2.5 12s3.5 7 9.5 7c1.5 0 2.8-.4 4-.9"></path>
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
          </svg>`;
      button.setAttribute(
        "aria-label",
        showing ? "Show password" : "Hide password"
      );
    });
  });
}

/* ---------- AI ---------- */

function setupAI() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai]");
    if (!button) return;

    const aiType = button.dataset.ai;

    if (aiType === "buyer") {
      show("buyerAI");
    }

    if (aiType === "seller") {
      show("sellerAI");
    }
  });

  const setupChat = ({ formId, inputId, messagesId, statusId }) => {
    const form = document.getElementById(formId);
    const input = document.getElementById(inputId);
    const messages = document.getElementById(messagesId);
    const status = document.getElementById(statusId);

    if (!form || !input || !messages) return;

    const addMessage = (text, type) => {
      const message = document.createElement("div");
      message.className = `zenodic-ai-message zenodic-ai-message-${type}`;
      message.textContent = text;
      messages.appendChild(message);
      messages.scrollTop = messages.scrollHeight;
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const message = input.value.trim();
      if (!message) return;

      addMessage(message, "user");
      input.value = "";

      if (status) status.textContent = "Thinking...";

      try {
        const response = await fetch(API_BASE + "/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "same-origin",
          body: JSON.stringify({ message })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Zenodic AI haikuweza kujibu."
          );
        }

        addMessage(
          data.result?.text || "Hakuna jibu lililorudishwa.",
          "assistant"
        );

        if (status) status.textContent = "Ready";
      } catch (error) {
        addMessage(
          error.message || "Kuna tatizo la kuwasiliana na Zenodic AI.",
          "assistant"
        );

        if (status) status.textContent = "Unavailable";
      }
    });
  };

  setupChat({
    formId: "buyerAIChatForm",
    inputId: "buyerAIChatInput",
    messagesId: "buyerAIChatMessages",
    statusId: "buyerAIStatus"
  });

  setupChat({
    formId: "sellerAIChatForm",
    inputId: "sellerAIChatInput",
    messagesId: "sellerAIChatMessages",
    statusId: "sellerAIStatus"
  });
}
  function setupLogout() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-logout]");

      if (!button) return;

      state.user = null;
      state.role = "";

      localStorage.removeItem("zenodic_role");

      show("home");
    });
  }

  /* ---------- ADMIN ---------- */

  function setupAdmin() {
    const adminLoginForm = document.getElementById("adminLoginForm");
    console.log("ADMIN SETUP:", !!adminLoginForm);

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-admin-login]");
      if (!button) return;

      show("adminLogin");
    });

    if (!adminLoginForm) return;

    adminLoginForm.addEventListener("submit", async (event) => {
      console.log("ADMIN SUBMIT EVENT");
      event.preventDefault();

      const email =
        document.getElementById("adminEmail")?.value.trim() || "";

      const password =
        document.getElementById("adminPassword")?.value || "";

      if (!email || !password) {
        alert("Email na password vinahitajika.");
        return;
      }

      const submitButton = adminLoginForm.querySelector(
        'button[type="submit"]'
      );

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Inaingia...";
      }

      try {
        const gatewayResponse = await fetch(
          "/api/admin/gateway-login",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
              email,
              password
            })
          }
        );

        const gatewayData = await gatewayResponse
          .json()
          .catch(() => ({}));


        if (!gatewayResponse.ok || !gatewayData.success) {
          throw new Error(
            gatewayData.message ||
            "Admin gateway verification imeshindikana."
          );
        }

        const adminResponse = await fetch(
          "/api/admin/login",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
              email,
              password
            })
          }
        );

        const adminData = await adminResponse
          .json()
          .catch(() => ({}));





        if (
          !adminResponse.ok ||
          !adminData.success ||
          !adminData.token
        ) {
          throw new Error(
            adminData.message ||
            "Admin login imeshindikana."
          );
        }

        sessionStorage.setItem(
          "zenodic_admin_token",
          adminData.token
        );

        sessionStorage.setItem(
          "zenodic_admin_user",
          JSON.stringify(adminData.admin || {})
        );

        adminLoginForm.reset();
        show("adminDashboard");

      } catch (error) {
        console.error("Admin login error:", error);
        alert(
          error.message ||
          "Admin login imeshindikana."
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Ingia kama Admin";
        }
      }
    });
  }

  /* ---------- INITIALIZATION ---------- */

  function init() {
    console.log("INIT STARTED");
    setupBuyerOverview();
    setupBuyerOrders();
    setBuyerSectionView("");
    setupNavigation();
    setupRoles();
    setupAuthTabs();
    setupPasswordToggle();
    setupRegisterRoleStep();
    setupLogin();
    setupRegister();
    setupSocialAuth();
    setupDashboardButtons();
    setupMarketplace();
    setupWholesaleRFQ();
    setupWholesaleOrders();
setupWholesaleProductionCreate();
setupWholesaleSidebarNavigation();
    setupWholesaleProductionProgress();
    setupOrderDetails();
    setupSellerOrders();
    setupSellerOverview();
    setupSellerProducts();
    setupSellerEarnings();
    setupSellerAppPages();
    setupSellerAppNavigation();
    initSellerNotifications();
    // setupSellerSections(); // legacy navigation disabled
    setupAI();
    setupLogout();
    console.log("BEFORE ADMIN SETUP");
    setupAdmin();

    setLanguage(state.language);

    startIntro();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

/* =========================================================
   ZENODIC SELLER PAYMENTS
   Live seller payment summary + transaction activity.
   ========================================================= */

(function () {
  const SELLER_PAYMENTS_TEST_SELLER_ID = 2;

  function formatSellerPaymentMoney(amount, currency = "TZS") {
    const value = Number(amount || 0);

    return new Intl.NumberFormat("en-TZ", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(value);
  }

  function setSellerPaymentsMessage(message) {
    const box = document.getElementById("sellerPaymentsMessage");
    if (!box) return;

    if (!message) {
      box.style.display = "none";
      box.textContent = "";
      return;
    }

    box.style.display = "block";
    box.textContent = message;
  }

  function getSellerPaymentStatusClass(status) {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "paid") {
      return "is-paid";
    }

    if (normalized === "failed" || normalized === "cancelled") {
      return "is-failed";
    }

    return "is-pending";
  }

  function renderSellerPayoutAccount(settings) {
    const container = document.getElementById(
      "sellerPaymentsPayoutAccount"
    );

    if (!container) return;

    if (!settings) {
      container.innerHTML = `
        <div class="seller-payout-account-empty">
          No payout settings found. Configure your payout account in Settings.
        </div>
      `;
      return;
    }

    const method = settings.method || settings.payout_method || "—";
    const accountName =
      settings.account_name ||
      settings.payout_account_name ||
      "Not configured";

    const accountNumber =
      settings.account_number ||
      settings.payout_account_number ||
      "Not configured";

    const schedule =
      settings.schedule ||
      settings.payout_schedule ||
      "—";

    const displayMethod =
      method === "mobile_money"
        ? "Mobile Money"
        : method === "bank"
          ? "Bank Account"
          : method;

    container.innerHTML = `
      <div class="seller-payout-account-card">
        <div class="seller-payout-account-row">
          <span>Method</span>
          <strong>${displayMethod}</strong>
        </div>

        <div class="seller-payout-account-row">
          <span>Account name</span>
          <strong>${accountName}</strong>
        </div>

        <div class="seller-payout-account-row">
          <span>Account / phone</span>
          <strong>${accountNumber}</strong>
        </div>

        <div class="seller-payout-account-row">
          <span>Schedule</span>
          <strong>${schedule}</strong>
        </div>
      </div>
    `;
  }

  function renderSellerPaymentTransactions(transactions, currency) {
    const container = document.getElementById(
      "sellerPaymentsTransactions"
    );

    if (!container) return;

    if (!Array.isArray(transactions) || !transactions.length) {
      container.innerHTML = `
        <div class="seller-payments-empty">
          No payment activity yet.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="seller-payments-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Gross</th>
            <th>Admin fee</th>
            <th>Your earnings</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody>
          ${transactions.map(tx => {
            const status = String(tx.status || "").toLowerCase();
            const statusClass =
              getSellerPaymentStatusClass(status);

            const date = tx.paid_at || tx.created_at || "—";

            return `
              <tr>
                <td>
                  <div class="seller-payment-order">
                    ${tx.order_number || `Order #${tx.order_id}`}
                  </div>
                  <div class="seller-payment-ref">
                    ${tx.payment_reference || "—"}
                  </div>
                </td>

                <td>
                  <span class="seller-payment-gross">
                    ${formatSellerPaymentMoney(
                      tx.gross_amount,
                      currency
                    )}
                  </span>
                </td>

                <td>
                  <span class="seller-payment-fee">
                    ${formatSellerPaymentMoney(
                      tx.commission_amount,
                      currency
                    )}
                  </span>
                  ${
                    tx.commission_rate
                      ? `<div class="seller-payment-ref">
                          ${tx.commission_rate}%
                        </div>`
                      : ""
                  }
                </td>

                <td>
                  <span class="seller-payment-net">
                    ${
                      tx.seller_net_amount !== null
                        ? formatSellerPaymentMoney(
                            tx.seller_net_amount,
                            currency
                          )
                        : "—"
                    }
                  </span>
                </td>

                <td>
                  <span class="seller-payment-status ${statusClass}">
                    ${status || "pending"}
                  </span>
                </td>

                <td>${date}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  async function loadSellerPayments() {
    const sellerId = SELLER_PAYMENTS_TEST_SELLER_ID;

    setSellerPaymentsMessage("");

    try {
      const [
        summaryResponse,
        transactionsResponse
      ] = await Promise.all([
        fetch(
          `/api/seller/payments/summary`,
          {
            credentials: "include"
          }
        ),

        fetch(
          `/api/seller/payments/transactions`,
          {
            credentials: "include"
          }
        )
      ]);

      if (!summaryResponse.ok) {
        throw new Error("Failed to load payment summary");
      }

      if (!transactionsResponse.ok) {
        throw new Error("Failed to load payment transactions");
      }

      const summaryData = await summaryResponse.json();
      const transactionsData =
        await transactionsResponse.json();

      if (!summaryData.success) {
        throw new Error(
          summaryData.error ||
          "Unable to load payment summary"
        );
      }

      if (!transactionsData.success) {
        throw new Error(
          transactionsData.error ||
          "Unable to load payment transactions"
        );
      }

      const summary = summaryData.summary || {};
      const currency = summaryData.currency || "TZS";

      const available =
        document.getElementById("sellerAvailableBalance");

      const earned =
        document.getElementById("sellerTotalEarned");

      const paidOut =
        document.getElementById("sellerTotalPaidOut");

      const pending =
        document.getElementById("sellerPendingPayouts");

      if (available) {
        available.textContent =
          formatSellerPaymentMoney(
            summary.available_balance,
            currency
          );
      }

      if (earned) {
        earned.textContent =
          formatSellerPaymentMoney(
            summary.total_earned,
            currency
          );
      }

      if (paidOut) {
        paidOut.textContent =
          formatSellerPaymentMoney(
            summary.total_paid_out,
            currency
          );
      }

      if (pending) {
        pending.textContent =
          formatSellerPaymentMoney(
            summary.pending_payouts,
            currency
          );
      }

      const payoutRequestCurrency =
        document.getElementById(
          "sellerPayoutRequestCurrency"
        );

      const payoutRequestAvailable =
        document.getElementById(
          "sellerPayoutRequestAvailable"
        );

      if (payoutRequestCurrency) {
        payoutRequestCurrency.textContent = currency;
      }

      if (payoutRequestAvailable) {
        payoutRequestAvailable.textContent =
          formatSellerPaymentMoney(
            summary.available_balance,
            currency
          );
      }

      renderSellerPayoutAccount(
        summaryData.payout_settings
      );

      renderSellerPaymentTransactions(
        transactionsData.transactions || [],
        currency
      );

    } catch (error) {
      console.error(
        "Seller payments load error:",
        error
      );

      setSellerPaymentsMessage(
        "Imeshindikana kupakia payment information."
      );
    }
  }

  function initSellerPayments() {
    const refreshButton =
      document.getElementById(
        "refreshSellerPaymentsBtn"
      );

    if (
      refreshButton &&
      !refreshButton.dataset.paymentsBound
    ) {
      refreshButton.dataset.paymentsBound = "1";

      refreshButton.addEventListener(
        "click",
        loadSellerPayments
      );
    }

    const settingsButton =
      document.getElementById(
        "openSellerPayoutSettingsBtn"
      );

    if (
      settingsButton &&
      !settingsButton.dataset.paymentsBound
    ) {
      settingsButton.dataset.paymentsBound = "1";

      settingsButton.addEventListener(
        "click",
        () => {
          const settingsNav =
            document.querySelector(
              '[data-seller-nav="settings"]'
            );

          settingsNav?.click();
        }
      );
    }
    initSellerPayoutRequest();
  }

  async function requestSellerPayout() {
    const amountInput = document.getElementById("sellerPayoutRequestAmount");
    const button = document.getElementById("requestSellerPayoutBtn");
    const message = document.getElementById("sellerPayoutRequestMessage");

    if (!amountInput || !button || !message) return;

    const amount = Number(amountInput.value);

    message.style.display = "none";
    message.textContent = "";

    if (!Number.isFinite(amount) || amount <= 0) {
      message.textContent = "Weka amount sahihi ya payout.";
      message.style.display = "block";
      return;
    }

    button.disabled = true;
    button.textContent = "Submitting...";

    try {
      const response = await fetch(API_BASE + "/api/seller/payments/payout-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ amount })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Imeshindikana kutuma payout request."
        );
      }

      message.textContent =
        data.message || "Payout request imepokelewa.";
      message.style.display = "block";

      amountInput.value = "";

      await loadSellerPayments();
    } catch (error) {
      console.error("Seller payout request error:", error);

      message.textContent =
        error.message || "Imeshindikana kutuma payout request.";
      message.style.display = "block";
    } finally {
      button.disabled = false;
      button.textContent = "Request Payout";
    }
  }

  function initSellerPayoutRequest() {
    const button = document.getElementById("requestSellerPayoutBtn");

    if (!button || button.dataset.payoutBound) return;

    button.dataset.payoutBound = "1";
    button.addEventListener("click", requestSellerPayout);

  }

    initSellerPayoutRequest();
  window.loadSellerPayments =
    loadSellerPayments;

  window.initSellerPayments =
    initSellerPayments;

})();

async function loadWholesaleInventory() {
  const debugEl = document.getElementById("wholesaleInventoryLoading");
  if (debugEl) debugEl.innerHTML = "<span style=\"grid-column:1 / -1;\">Inventory loader started...</span>";
  const table = document.getElementById("wholesaleInventoryTable");
  const loading = document.getElementById("wholesaleInventoryLoading");
  const empty = document.getElementById("wholesaleInventoryEmpty");

  if (!table || !state.user?.id) { if (table) table.innerHTML = "<div class=\"inventory-row\"><span style=\"grid-column:1 / -1;\">Inventory could not load: user session is missing.</span></div>"; console.warn("WHOLESALE INVENTORY: missing table or user", { table: !!table, user: state.user }); return; }

  try {
    if (loading) loading.style.display = "";

    const response = await fetch(`${API_BASE}/api/inventory/wholesale/${state.user.id}`, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load inventory");
    }

    const products = Array.isArray(data.products) ? data.products : [];
    setupWholesaleInventoryFilters();

    const rows = table.querySelectorAll(".inventory-row:not(.inventory-head)");
    rows.forEach(row => row.remove());

    if (empty) empty.style.display = products.length ? "none" : "";

    const availableTotal = products.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const reserved = Number(item.reserved_quantity) || 0;
      return sum + Math.max(0, quantity - reserved);
    }, 0);

    const lowStock = products.filter(item => {
      const quantity = Number(item.quantity) || 0;
      const reserved = Number(item.reserved_quantity) || 0;
      const available = Math.max(0, quantity - reserved);
      const reorder = Number(item.reorder_level) || 0;
      return available > 0 && available <= reorder;
    }).length;

    const outOfStock = products.filter(item => {
      const quantity = Number(item.quantity) || 0;
      const reserved = Number(item.reserved_quantity) || 0;
      return quantity - reserved <= 0;
    }).length;

    const totalProducts = document.getElementById("inventoryTotalProducts");
    const availableStock = document.getElementById("inventoryAvailableStock");
    const lowStockEl = document.getElementById("inventoryLowStock");
    const outOfStockEl = document.getElementById("inventoryOutOfStock");

    if (totalProducts) totalProducts.textContent = products.length.toLocaleString();
    if (availableStock) availableStock.textContent = availableTotal.toLocaleString();
    if (lowStockEl) lowStockEl.textContent = lowStock.toLocaleString();
    if (outOfStockEl) outOfStockEl.textContent = outOfStock.toLocaleString();

    products.forEach(item => {
      const quantity = Number(item.quantity) || 0;
      const reserved = Number(item.reserved_quantity) || 0;
      const available = Math.max(0, quantity - reserved);
      const reorder = Number(item.reorder_level) || 0;

      let status = "HEALTHY";
      let statusClass = "inventory-good";

      if (available <= 0) {
        status = "OUT OF STOCK";
        statusClass = "inventory-out";
      } else if (available <= reorder) {
        status = "LOW";
        statusClass = "inventory-low";
      }

      const row = document.createElement("div");
      row.className = "inventory-row";

      row.innerHTML = `
        <strong>${item.item_name || "Unnamed Product"}</strong>
        <span>${item.sku || "—"}</span>
        <span>${available.toLocaleString()} ${item.unit || "units"}</span>
        <span class="${statusClass}">${status}</span>
        <span>${item.location || "—"}</span>
        <span>${item.price != null ? Number(item.price).toLocaleString() : "—"}</span>
        <button type="button" data-wholesale-action="inventory" data-inventory-id="${item.id}">View</button>
      `;

      table.appendChild(row);
    });
  } catch (error) {
    console.error("WHOLESALE INVENTORY LOAD ERROR:", error);

    const rows = table.querySelectorAll(".inventory-row:not(.inventory-head)");
    rows.forEach(row => row.remove());

    const row = document.createElement("div");
    row.className = "inventory-row";
    row.innerHTML = `
      <span style="grid-column:1 / -1;">Inventory error: check browser console</span>
    `;

    table.appendChild(row);

    if (empty) empty.style.display = "none";
  }
}


function setupWholesaleInventoryFilters() {
  const search = document.getElementById("wholesaleInventorySearch");
  const filter = document.getElementById("wholesaleInventoryStatusFilter");
  const table = document.getElementById("wholesaleInventoryTable");

  if (!search || !filter || !table || table.dataset.filtersReady === "true") return;

  const applyFilters = () => {
    const query = search.value.trim().toLowerCase();
    const statusFilter = filter.value;

    table.querySelectorAll(".inventory-row:not(.inventory-head)").forEach(row => {
      if (row.id === "wholesaleInventoryLoading") return;

      const text = row.textContent.toLowerCase();
      const status = row.querySelector(".inventory-low, .inventory-good, .inventory-out")?.textContent.toLowerCase() || "";

      const matchesSearch = !query || text.includes(query);

      let matchesStatus = true;
      if (statusFilter === "healthy") {
        matchesStatus = status.includes("healthy");
      } else if (statusFilter === "low") {
        matchesStatus = status.includes("low");
      } else if (statusFilter === "out") {
        matchesStatus = status.includes("out");
      }

      row.style.display = matchesSearch && matchesStatus ? "" : "none";
    });
  };

  search.addEventListener("input", applyFilters);
  filter.addEventListener("change", applyFilters);

  table.dataset.filtersReady = "true";
}

