const API = window.location.origin;

console.log("ADMIN JS LOADED - TOKEN:", sessionStorage.getItem("zenodicAdminToken") ? "YES" : "NO");
const adminApp =
  document.getElementById("adminApp");

const adminName =
  document.getElementById("adminName");

async function loadAdmin() {
  console.log("ADMIN AUTH: checking backend session");

  try {
    const response = await fetch(`${API}/api/admin/me`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json",
        ...(sessionStorage.getItem("zenodicAdminToken") ? {
          "Authorization": `Bearer ${sessionStorage.getItem("zenodicAdminToken")}`
        } : {})
      }
    });

    const data = await response.json();

    console.log("ADMIN /ME:", response.status, data);

    if (!response.ok || !data.success) {
      console.error("ADMIN AUTH FAILED:", data);

      if (adminApp) {
        adminApp.style.display = "flex";
        adminApp.innerHTML = `
          <div style="padding:30px;font-family:system-ui;">
            <h2>Admin authentication failed</h2>
            <p>Backend response: <strong>${response.status}</strong></p>
            <p>${String(data.message || "Admin session haipo au ime-expire.")}</p>
          </div>
        `;
      }

      return false;
    }

    if (adminName) {
      adminName.textContent =
        data.admin?.username ||
        data.admin?.email ||
        "Admin";
    }

    if (adminApp) {
      adminApp.style.display = "flex";
    }

    console.log("ADMIN AUTH SUCCESS:", data.admin);

    return true;

  } catch (error) {
    console.error("ADMIN /ME CONNECTION ERROR:", error);

    if (adminApp) {
      adminApp.style.display = "flex";
      adminApp.innerHTML = `
        <div style="padding:30px;font-family:system-ui;">
          <h2>Admin connection error</h2>
          <p>${String(error.message || error)}</p>
        </div>
      `;
    }

    return false;
  }
}

const sections = document.querySelectorAll(".section");
const navItems = document.querySelectorAll(".nav-item");
const quickActions = document.querySelectorAll("[data-section]");
const pageTitle = document.getElementById("pageTitle");
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menuBtn");
const logoutBtn = document.getElementById("logoutBtn");

function showSection(sectionId) {
  sections.forEach((section) => {
    section.classList.toggle(
      "active",
      section.id === sectionId
    );
  });

  navItems.forEach((item) => {
    item.classList.toggle(
      "active",
      item.dataset.section === sectionId
    );
  });

  const activeItem = document.querySelector(
    `.nav-item[data-section="${sectionId}"]`
  );

  if (activeItem) {
    pageTitle.textContent =
      activeItem.textContent.trim();
  }

  sidebar.classList.remove("open");
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    showSection(item.dataset.section);
  });
});

quickActions.forEach((button) => {
  button.addEventListener("click", () => {
    showSection(button.dataset.section);
  });
});

document.querySelectorAll("[data-settings-nav]").forEach((button) => {
  button.addEventListener("click", () => {
    showSection(button.dataset.settingsNav);
  });
});

menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("zenodicAdminToken");
  window.location.href = "index.html";
});

async function loadUsers() {
  const token = sessionStorage.getItem("zenodicAdminToken");
  if (!token) return;

  const usersSection = document.getElementById("users");
  if (!usersSection) return;

  try {
    const response = await fetch("/api/admin/management/users", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kupakia users.");
    }

    const users = Array.isArray(data.users) ? data.users : [];

    const totalUsers = document.getElementById("totalUsers");
    if (totalUsers) {
      totalUsers.textContent = users.length;
    }

    const oldPanel = usersSection.querySelector(".users-data-panel");
    if (oldPanel) oldPanel.remove();

    const panel = document.createElement("div");
    panel.className = "panel users-data-panel";

    if (users.length === 0) {
      panel.innerHTML = `
        <div class="empty">
          Hakuna users waliosajiliwa bado.
        </div>
      `;
    } else {
      const rows = users.map((user) => {
        const displayName = user.name || user.email || "User";
        const role = user.role || "buyer";
        const status = user.account_status || "active";

        return `
          <button
            type="button"
            class="admin-user-row"
            data-user-id="${user.id}"
            style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 4px;border:0;border-bottom:1px solid rgba(0,0,0,.08);background:transparent;text-align:left;cursor:pointer;"
          >
            <span style="min-width:0;">
              <strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${escapeHTML(displayName)}
              </strong>
              <small style="display:block;opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${escapeHTML(user.email || "")}
              </small>
            </span>
            <span style="font-size:12px;white-space:nowrap;opacity:.75;">
              ${escapeHTML(role)} · ${escapeHTML(status)}
            </span>
          </button>
        `;
      }).join("");

      panel.innerHTML = `
        <div class="panel-header">
          <div>
            <h2>Registered Users</h2>
            <p>Bonyeza jina au email kuona taarifa kamili.</p>
          </div>
        </div>

        <div>
          ${rows}
        </div>
      `;

      panel.querySelectorAll(".admin-user-row").forEach((button) => {
        button.addEventListener("click", () => {
          openAdminUserDetails(button.dataset.userId);
        });
      });
    }

    usersSection.appendChild(panel);

  } catch (error) {
    console.error("LOAD USERS ERROR:", error);

    const oldPanel = usersSection.querySelector(".users-data-panel");
    if (oldPanel) oldPanel.remove();

    const panel = document.createElement("div");
    panel.className = "panel users-data-panel";
    panel.innerHTML = `
      <div class="empty">
        Imeshindikana kupakia users. Jaribu tena.
      </div>
    `;
    usersSection.appendChild(panel);
  }
}

async function openAdminUserDetails(userId) {
  const token = sessionStorage.getItem("zenodicAdminToken");
  const modal = document.getElementById("adminUserModal");
  const content = document.getElementById("adminUserModalContent");
  const title = document.getElementById("adminUserModalTitle");
  const subtitle = document.getElementById("adminUserModalSubtitle");
  const actions = document.getElementById("adminUserModalActions");

  if (!token || !modal || !content) return;

  modal.style.display = "block";
  content.innerHTML = "<p>Inapakia taarifa za user...</p>";
  actions.innerHTML = "";

  try {
    const response = await fetch(
      `/api/admin/management/users/${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        credentials: "include"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kupata taarifa.");
    }

    const user = data.user || {};

    title.textContent = user.name || user.email || "User Details";
    subtitle.textContent = user.email || "";

    content.innerHTML = `
      <div style="display:grid;gap:12px;">
        <div><strong>ID:</strong> ${escapeHTML(user.id)}</div>
        <div><strong>Jina:</strong> ${escapeHTML(user.name || "-")}</div>
        <div><strong>Email:</strong> ${escapeHTML(user.email || "-")}</div>
        <div><strong>Role:</strong> ${escapeHTML(user.role || "-")}</div>
        <div><strong>Provider:</strong> ${escapeHTML(user.provider || "-")}</div>
        <div><strong>Status:</strong> ${escapeHTML(user.account_status || "active")}</div>
        <div><strong>Verification:</strong> ${escapeHTML(user.verification_status || "N/A")}</div>
        <div><strong>Products:</strong> ${escapeHTML(user.productCount ?? 0)}</div>
        <div><strong>Created:</strong> ${escapeHTML(user.created_at || "-")}</div>
        <div><strong>Last login:</strong> ${escapeHTML(user.last_login_at || "-")}</div>
      </div>
    `;

    const isSuspended = user.account_status === "suspended";
    const isDeleted = user.account_status === "deleted";
    const canVerify =
      user.role === "seller" || user.role === "wholesale";

    if (!isDeleted) {
      actions.innerHTML += `
        <button
          type="button"
          id="adminSuspendBtn"
          data-user-id="${escapeHTML(user.id)}"
          style="padding:10px 16px;border:0;border-radius:10px;cursor:pointer;"
        >
          ${isSuspended ? "Unsuspend User" : "Suspend User"}
        </button>

        <button
          type="button"
          id="adminDeleteBtn"
          data-user-id="${escapeHTML(user.id)}"
          style="padding:10px 16px;border:0;border-radius:10px;cursor:pointer;"
        >
          Delete User
        </button>
      `;
    }

    if (canVerify) {
      actions.innerHTML += `
        <button
          type="button"
          id="adminVerifyBtn"
          data-user-id="${escapeHTML(user.id)}"
          style="padding:10px 16px;border:0;border-radius:10px;cursor:pointer;"
        >
          Verify
        </button>

        <button
          type="button"
          id="adminRejectBtn"
          data-user-id="${escapeHTML(user.id)}"
          style="padding:10px 16px;border:0;border-radius:10px;cursor:pointer;"
        >
          Reject
        </button>
      `;
    }

    document.getElementById("adminSuspendBtn")?.addEventListener("click", () => {
      updateAdminUserSuspension(user.id, !isSuspended);
    });

    document.getElementById("adminDeleteBtn")?.addEventListener("click", () => {
      deleteAdminUser(user.id);
    });

    document.getElementById("adminVerifyBtn")?.addEventListener("click", () => {
      updateAdminUserVerification(user.id, "verified");
    });

    document.getElementById("adminRejectBtn")?.addEventListener("click", () => {
      updateAdminUserVerification(user.id, "rejected");
    });

  } catch (error) {
    console.error("ADMIN USER DETAILS ERROR:", error);
    content.innerHTML = `
      <div class="empty">
        ${escapeHTML(error.message || "Imeshindikana kupata taarifa za user.")}
      </div>
    `;
  }
}

function closeAdminUserModal() {
  const modal = document.getElementById("adminUserModal");
  if (modal) modal.style.display = "none";
}

document.getElementById("adminUserModalClose")?.addEventListener(
  "click",
  closeAdminUserModal
);

document.getElementById("adminUserModal")?.addEventListener(
  "click",
  (event) => {
    if (event.target.id === "adminUserModal") {
      closeAdminUserModal();
    }
  }
);

async function updateAdminUserSuspension(userId, suspend) {
  const token = sessionStorage.getItem("zenodicAdminToken");
  if (!token) return;

  try {
    const response = await fetch(
      `/api/admin/management/users/${encodeURIComponent(userId)}/suspension`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        credentials: "include",
        body: JSON.stringify({ suspended: suspend })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kubadilisha status.");
    }

    await loadUsers();
    await loadSellers();
    await openAdminUserDetails(userId);
  } catch (error) {
    alert(error.message || "Imeshindikana.");
  }
}

async function updateAdminUserVerification(userId, status) {
  const token = sessionStorage.getItem("zenodicAdminToken");
  if (!token) return;

  try {
    const response = await fetch(
      `/api/admin/management/users/${encodeURIComponent(userId)}/verification`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        credentials: "include",
        body: JSON.stringify({ status })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kubadilisha verification.");
    }

    await loadUsers();
    await openAdminUserDetails(userId);
  } catch (error) {
    alert(error.message || "Imeshindikana.");
  }
}

async function deleteAdminUser(userId) {
  const token = sessionStorage.getItem("zenodicAdminToken");
  if (!token) return;

  if (!confirm("Una uhakika unataka kum-delete user huyu?")) {
    return;
  }

  try {
    const response = await fetch(
      `/api/admin/management/users/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        },
        credentials: "include"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kum-delete user.");
    }

    closeAdminUserModal();
    await loadUsers();
  } catch (error) {
    alert(error.message || "Imeshindikana.");
  }
}

async function loadSellers() {
  const token = sessionStorage.getItem("zenodicAdminToken");
  const sellersSection = document.getElementById("sellers");

  if (!token || !sellersSection) return;

  try {
    const response = await fetch("/api/admin/management/users", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kupakia sellers.");
    }

    const sellers = (Array.isArray(data.users) ? data.users : [])
      .filter(user => user.role === "seller" || user.role === "wholesale");

    const oldPanel = sellersSection.querySelector(".sellers-data-panel");
    if (oldPanel) oldPanel.remove();

    const panel = document.createElement("div");
    panel.className = "panel sellers-data-panel";

    if (sellers.length === 0) {
      panel.innerHTML = `
        <div class="empty">
          Hakuna sellers au wholesalers bado.
        </div>
      `;
    } else {
      const rows = sellers.map((user) => {
        const displayName = user.name || user.email || "User";
        const verification = user.verification_status || "pending";
        const accountStatus = user.account_status || "active";

        return `
          <button
            type="button"
            class="admin-seller-row"
            data-user-id="${escapeHTML(user.id)}"
            style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 4px;border:0;border-bottom:1px solid rgba(0,0,0,.08);background:transparent;text-align:left;cursor:pointer;"
          >
            <span style="min-width:0;">
              <strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${escapeHTML(displayName)}
              </strong>
              <small style="display:block;opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${escapeHTML(user.email || "")}
              </small>
            </span>

            <span style="font-size:12px;white-space:nowrap;opacity:.8;">
              ${escapeHTML(user.role)} · ${escapeHTML(verification)} · ${escapeHTML(accountStatus)}
            </span>
          </button>
        `;
      }).join("");

      panel.innerHTML = `
        <div class="panel-header">
          <div>
            <h2>Sellers & Wholesalers</h2>
            <p>Bonyeza seller kuona taarifa na kufanya verification.</p>
          </div>
        </div>

        <div>
          ${rows}
        </div>
      `;

      panel.querySelectorAll(".admin-seller-row").forEach((button) => {
        button.addEventListener("click", () => {
          openAdminUserDetails(button.dataset.userId);
        });
      });
    }

    sellersSection.appendChild(panel);

  } catch (error) {
    console.error("LOAD SELLERS ERROR:", error);

    const oldPanel = sellersSection.querySelector(".sellers-data-panel");
    if (oldPanel) oldPanel.remove();

    const panel = document.createElement("div");
    panel.className = "panel sellers-data-panel";
    panel.innerHTML = `
      <div class="empty">
        Imeshindikana kupakia sellers.<br>
        <small>${escapeHTML(error.message || "Unknown error")}</small>
      </div>
    `;

    sellersSection.appendChild(panel);
  }
}

async function loadProducts() {
  const token = sessionStorage.getItem("zenodicAdminToken");
  const section = document.getElementById("products");

  if (!token || !section) return;

  const content = document.getElementById("productsContent");
  if (!content) return;

  try {
    const response = await fetch("/api/admin/management/products", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kupakia products.");
    }

    const products = Array.isArray(data.products) ? data.products : [];

    if (products.length === 0) {
      content.innerHTML = `
        <div class="empty">
          Hakuna products za sellers au wholesalers.
        </div>
      `;
      return;
    }

    const pending = products.filter(p => p.approval_status === "pending").length;
    const approved = products.filter(p => p.approval_status === "approved").length;
    const rejected = products.filter(p => p.approval_status === "rejected").length;

    const rows = products.map((product) => {
      const status = product.approval_status || "pending";
      const owner = product.user_name || product.user_email || "Unknown seller";

      return `
        <div
          style="padding:16px 4px;border-bottom:1px solid rgba(0,0,0,.08);"
        >
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
            <div style="min-width:0;">
              <strong style="display:block;">
                ${escapeHTML(product.item_name || product.product_name || "Product")}
              </strong>

              <small style="display:block;opacity:.65;margin-top:4px;">
                ${escapeHTML(owner)}
              </small>

              <small style="display:block;opacity:.65;margin-top:3px;">
                ${escapeHTML(product.user_role || "")}
                · Qty: ${escapeHTML(product.quantity ?? "-")}
                ${product.price != null ? `· Price: ${escapeHTML(product.price)}` : ""}
              </small>
            </div>

            <span style="font-size:12px;white-space:nowrap;">
              ${escapeHTML(status)}
            </span>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
            <button
              type="button"
              class="admin-product-approve"
              data-product-id="${escapeHTML(product.id)}"
              style="padding:8px 12px;border:0;border-radius:8px;cursor:pointer;"
              ${status === "approved" ? "disabled" : ""}
            >
              Approve
            </button>

            <button
              type="button"
              class="admin-product-reject"
              data-product-id="${escapeHTML(product.id)}"
              style="padding:8px 12px;border:0;border-radius:8px;cursor:pointer;"
              ${status === "rejected" ? "disabled" : ""}
            >
              Reject
            </button>
          </div>
        </div>
      `;
    }).join("");

    content.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
        <div><strong>Pending:</strong> ${pending}</div>
        <div><strong>Approved:</strong> ${approved}</div>
        <div><strong>Rejected:</strong> ${rejected}</div>
      </div>

      <div>
        ${rows}
      </div>
    `;

    content.querySelectorAll(".admin-product-approve").forEach((button) => {
      button.addEventListener("click", () => {
        updateAdminProductApproval(button.dataset.productId, "approved");
      });
    });

    content.querySelectorAll(".admin-product-reject").forEach((button) => {
      button.addEventListener("click", () => {
        updateAdminProductApproval(button.dataset.productId, "rejected");
      });
    });

  } catch (error) {
    console.error("LOAD PRODUCTS ERROR:", error);

    content.innerHTML = `
      <div class="empty">
        Imeshindikana kupakia products.<br>
        <small>${escapeHTML(error.message || "Unknown error")}</small>
      </div>
    `;
  }
}

async function updateAdminProductApproval(productId, status) {
  const token = sessionStorage.getItem("zenodicAdminToken");
  if (!token) return;

  try {
    const response = await fetch(
      `/api/admin/management/products/${encodeURIComponent(productId)}/approval`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        credentials: "include",
        body: JSON.stringify({ status })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kubadilisha approval ya product."
      );
    }

    await loadProducts();

  } catch (error) {
    alert(error.message || "Imeshindikana.");
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
loadUsers();
loadSellers();
loadProducts();


function getAdminHeaders() {
  const token = sessionStorage.getItem("zenodicAdminToken");

  return {
    "Accept": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
}

async function loadOrders() {
  const ordersSection = document.getElementById("orders");
  if (!ordersSection) return;

  const content = document.getElementById("ordersContent");
  if (!content) return;

  content.innerHTML = `
    <div class="empty">
      Inapakia orders...
    </div>
  `;

  try {
    const response = await fetch("/api/admin/management/orders", {
      headers: getAdminHeaders()
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Imeshindikana kupata orders.");
    }

    const orders = Array.isArray(data.orders) ? data.orders : [];

    if (orders.length === 0) {
      content.innerHTML = `
        <div class="empty">
          Hakuna orders bado.
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="admin-orders-list">
        ${orders.map(function(order) {
          const orderNumber = escapeHTML(
            order.order_number || ("#" + order.id)
          );

          const status = escapeHTML(
            order.status || "pending"
          );

          const paymentStatus = escapeHTML(
            order.payment_status || "unpaid"
          );

          const amount = Number(
            order.total_amount || 0
          ).toLocaleString();

          return `
            <button
              type="button"
              class="admin-order-row"
              data-order-id="${escapeHTML(order.id)}"
            >
              <div class="admin-order-main">
                <strong>${orderNumber}</strong>
                <span>
                  ${escapeHTML(order.buyer_name || "Customer")}
                </span>
              </div>

              <div class="admin-order-meta">
                <strong>
                  ${escapeHTML(order.currency || "TZS")}
                  ${amount}
                </strong>

                <div class="admin-order-badges">
                  <span
                    class="admin-order-status-badge"
                    data-status="${status}"
                  >
                    ${status}
                  </span>

                  <span
                    class="admin-order-payment-badge"
                    data-payment="${paymentStatus}"
                  >
                    ${paymentStatus}
                  </span>
                </div>
              </div>

              <span class="admin-order-arrow">›</span>
            </button>
          `;
        }).join("")}
      </div>

      <div id="adminOrderDetails"></div>
    `;

    content.querySelectorAll(".admin-order-row").forEach(function(button) {
      button.addEventListener("click", async function() {
        loadOrderDetails(this.dataset.orderId);
      });
    });

  } catch (error) {
    console.error("Admin orders UI error:", error);

    content.innerHTML = `
      <div class="empty">
        ${escapeHTML(
          error.message || "Imeshindikana kupata orders."
        )}
      </div>
    `;
  }
}

async function loadOrderDetails(orderId) {
  let drawer = document.getElementById("adminOrderDrawer");

  if (!drawer) {
    drawer = document.createElement("div");
    drawer.id = "adminOrderDrawer";
    drawer.className = "admin-order-drawer";
    document.body.appendChild(drawer);
  }

  drawer.classList.add("is-open");
  document.body.classList.add("order-drawer-open");

  drawer.innerHTML = `
    <div class="admin-order-drawer-backdrop" data-close-order-drawer></div>

    <aside class="admin-order-drawer-panel" role="dialog" aria-modal="true">
      <div class="admin-order-drawer-header">
        <div>
          <span class="admin-order-drawer-eyebrow">ORDER DETAILS</span>
          <h2>📦 Order</h2>
        </div>

        <button
          type="button"
          class="admin-order-drawer-close"
          data-close-order-drawer
          aria-label="Close order details"
        >×</button>
      </div>

      <div class="admin-order-drawer-body">
        <div class="empty">Inapakia taarifa za order...</div>
      </div>
    </aside>
  `;

  function closeDrawer() {
    drawer.classList.remove("is-open");
    document.body.classList.remove("order-drawer-open");
  }

  drawer.querySelectorAll("[data-close-order-drawer]").forEach(function(button) {
    button.addEventListener("click", closeDrawer);
  });

  try {
    const response = await fetch(
      "/api/admin/management/orders/" + encodeURIComponent(orderId),
      {
        headers: getAdminHeaders()
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success || !data.order) {
      throw new Error(
        data.message || "Imeshindikana kupata taarifa za order."
      );
    }

    const order = data.order;
    const items = Array.isArray(order.items) ? order.items : [];
    const body = drawer.querySelector(".admin-order-drawer-body");

    body.innerHTML = `
      <div class="admin-order-drawer-order-number">
        <span>Order Number</span>
        <strong>
          ${escapeHTML(order.order_number || ("#" + order.id))}
        </strong>
      </div>

      <div class="admin-order-status-action">
        <span class="admin-order-status-action-label">
          Order Management
        </span>

        <div class="admin-order-status-row">
          <div>
            <span>Status</span>
            <select
              id="adminOrderStatus"
              class="admin-order-status-select"
            >
            ${[
              "pending",
              "confirmed",
              "processing",
              "shipped",
              "delivered"
            ].map(function(status) {
              return `
                <option
                  value="${status}"
                  ${order.status === status ? "selected" : ""}
                >
                  ${status}
                </option>
              `;
            }).join("")}
          </select>
        </div>

        <div>
          <span>Payment</span>
          <strong class="admin-order-payment-badge">
            ${escapeHTML(order.payment_status || "unpaid")}
          </strong>
        </div>
        </div>
      </div>

      ${
        order.status === "pending" && order.payment_status === "unpaid"
          ? `
            <div class="admin-order-cancel-action">
              <button
                type="button"
                class="admin-order-cancel-btn"
                id="adminOrderCancelBtn"
              >
                Cancel Order
              </button>
              <p>
                Cancellation itarejesha reserved stock. Hakuna refund itakayofanyika hapa.
              </p>
            </div>
          `
          : ""
      }

      <div class="admin-order-drawer-section">
        <h3>Customer</h3>
        <div class="admin-order-person-card">
          <strong>${escapeHTML(order.buyer_name || "—")}</strong>
          <span>${escapeHTML(order.buyer_email || "—")}</span>
        </div>
      </div>

      <div class="admin-order-drawer-section">
        <h3>Seller</h3>
        <div class="admin-order-person-card">
          <strong>${escapeHTML(order.seller_name || "—")}</strong>
          <span>${escapeHTML(order.seller_email || "—")}</span>
        </div>
      </div>

      <div class="admin-order-drawer-section">
        <h3>Products</h3>

        <div class="admin-order-drawer-items">
          ${
            items.length === 0
              ? `<div class="empty">Hakuna products kwenye order hii.</div>`
              : items.map(function(item) {
                  return `
                    <div class="admin-order-drawer-item">
                      <div>
                        <strong>
                          ${escapeHTML(item.product_name || "Product")}
                        </strong>
                        <span>
                          Qty: ${escapeHTML(item.quantity || 0)}
                          ${escapeHTML(item.unit || "")}
                        </span>
                      </div>

                      <div>
                        <span>
                          ${escapeHTML(order.currency || "TZS")}
                          ${Number(item.unit_price || 0).toLocaleString()}
                          / unit
                        </span>
                        <strong>
                          ${escapeHTML(order.currency || "TZS")}
                          ${Number(item.total_price || 0).toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  `;
                }).join("")
          }
        </div>
      </div>

      <div class="admin-order-total-card">
        <span>Total Amount</span>
        <strong>
          ${escapeHTML(order.currency || "TZS")}
          ${Number(order.total_amount || 0).toLocaleString()}
        </strong>
      </div>

      <div class="admin-order-drawer-section">
        <h3>Delivery</h3>

        <div class="admin-order-detail-list">
          <div>
            <span>Location</span>
            <strong>${escapeHTML(order.delivery_location || "—")}</strong>
          </div>

          <div>
            <span>Expected Delivery</span>
            <strong>${escapeHTML(order.expected_delivery || "—")}</strong>
          </div>
        </div>
      </div>

      <div class="admin-order-drawer-section">
        <h3>Timeline</h3>

        <div class="admin-order-detail-list">
          <div>
            <span>Created</span>
            <strong>${escapeHTML(order.created_at || "—")}</strong>
          </div>

          <div>
            <span>Updated</span>
            <strong>${escapeHTML(order.updated_at || "—")}</strong>
          </div>
        </div>
      </div>
    `;

    const cancelButton = body.querySelector("#adminOrderCancelBtn");

    if (cancelButton) {
      cancelButton.addEventListener("click", async function() {
        const confirmed = window.confirm(
          "Una uhakika unataka ku-cancel order hii? Reserved stock itarejeshwa. Hakuna refund itakayofanyika."
        );

        if (!confirmed) return;

        cancelButton.disabled = true;
        cancelButton.textContent = "Inacancel...";

        try {
          const response = await fetch(
            "/api/admin/management/orders/" +
              encodeURIComponent(orderId) +
              "/cancel",
            {
              method: "POST",
              headers: {
                ...getAdminHeaders(),
                "Content-Type": "application/json"
              }
            }
          );

          const result = await response.json().catch(() => ({}));

          if (!response.ok || !result.success) {
            throw new Error(
              result.message || "Imeshindikana ku-cancel order."
            );
          }

          alert(
            result.message ||
            "Order imecancelwa na reserved stock imerejeshwa."
          );

          await loadOrders();
          await loadOrderDetails(orderId);
        } catch (error) {
          console.error("Admin order cancellation UI error:", error);

          alert(
            error.message ||
            "Imeshindikana ku-cancel order."
          );

          cancelButton.disabled = false;
          cancelButton.textContent = "Cancel Order";
        }
      });
    }

    const statusSelect = body.querySelector("#adminOrderStatus");

    if (statusSelect) {
      statusSelect.addEventListener("change", async function() {
        const nextStatus = this.value;
        this.disabled = true;

        try {
          const response = await fetch(
            "/api/admin/management/orders/" +
            encodeURIComponent(orderId) +
            "/status",
            {
              method: "PATCH",
              headers: {
                ...getAdminHeaders(),
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                status: nextStatus
              })
            }
          );

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(
              result.message ||
              "Imeshindikana kubadilisha order status."
            );
          }

          await loadOrders();
          await loadOrderDetails(orderId);
        } catch (error) {
          console.error("Admin order status UI error:", error);
          alert(
            error.message ||
            "Imeshindikana kubadilisha order status."
          );

          this.value = order.status || "pending";
          this.disabled = false;
        }
      });
    }
  } catch (error) {
    console.error("Admin order details UI error:", error);

    const body = drawer.querySelector(".admin-order-drawer-body");

    body.innerHTML = `
      <div class="empty">
        ${escapeHTML(
          error.message ||
          "Imeshindikana kupata taarifa za order."
        )}
      </div>
    `;
  }
}


loadOrders();

async function loadPayments() {
  const paymentsSection = document.getElementById("payments");
  if (!paymentsSection) return;

  const oldPanel = paymentsSection.querySelector(".payments-data-panel");
  if (oldPanel) oldPanel.remove();

  const panel = document.createElement("div");
  panel.className = "panel payments-data-panel";
  panel.innerHTML = `
    <div class="empty">Inapakia payments...</div>
  `;
  paymentsSection.appendChild(panel);

  try {
    const token = sessionStorage.getItem("zenodicAdminToken");

    const response = await fetch("/api/admin/management/payments", {
      headers: {
        Authorization: token ? "Bearer " + token : ""
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Imeshindikana kupata payments.");
    }

    const payments = Array.isArray(data.payments)
      ? data.payments
      : [];

    if (payments.length === 0) {
      panel.innerHTML = `
        <div class="empty">
          Hakuna payment transactions bado.
        </div>
      `;
      return;
    }

    const rows = payments.map(function(payment) {
      const status = String(payment.status || "pending").toLowerCase();

      const statusClass =
        status === "paid"
          ? "status-success"
          : status === "failed"
          ? "status-danger"
          : status === "cancelled"
          ? "status-danger"
          : "status-warning";

      const amount = Number(payment.amount || 0).toLocaleString();

      const commission =
        payment.commission_amount == null
          ? "—"
          : Number(payment.commission_amount).toLocaleString();

      return `
        <tr>
          <td>
            <strong>${escapeHTML(payment.payment_reference || "—")}</strong>
          </td>
          <td>${escapeHTML(payment.order_number || "—")}</td>
          <td>
            ${escapeHTML(
              payment.buyer_name ||
              payment.buyer_email ||
              "Unknown buyer"
            )}
          </td>
          <td>
            ${escapeHTML(
              payment.seller_name ||
              payment.seller_email ||
              "Unknown seller"
            )}
          </td>
          <td>
            ${escapeHTML(payment.currency || "TZS")}
            ${amount}
          </td>
          <td>
            <span class="${statusClass}">
              ${escapeHTML(status)}
            </span>
          </td>
          <td>${commission}</td>
          <td>
            ${escapeHTML(payment.paid_at || payment.created_at || "—")}
          </td>
        </tr>
      `;
    }).join("");

    panel.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th>Payment Reference</th>
              <th>Order</th>
              <th>Buyer</th>
              <th>Seller</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Commission</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    console.error("Admin payments UI error:", error);

    panel.innerHTML = `
      <div class="empty">
        ${escapeHTML(
          error.message || "Imeshindikana kupata payments."
        )}
      </div>
    `;
  }
}
loadPayments();

async function loadAnalytics() {
  const token = sessionStorage.getItem("zenodicAdminToken");
  const analyticsSection = document.getElementById("analytics");

  if (!token || !analyticsSection) return;

  try {
    const response = await fetch("/api/admin/management/stats", {
      headers: {
        Authorization: `Bearer ${token}`
      },
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kupata admin statistics."
      );
    }

    const stats = data.stats || {};
    const users = stats.users || {};
    const products = stats.products || {};
    const orders = stats.orders || {};
    renderOrderOverview(users, products, orders);

    const totalUsers = Number(users.total || 0);
    const totalOrders = Number(orders.total || 0);
    const revenue = Number(orders.revenue || 0);
    const pendingOrders = Number(orders.pending || 0);
    const completedOrders = Number(orders.completed || 0);
    const paidOrders = Number(orders.paid || 0);

    const oldPanel = analyticsSection.querySelector(".analytics-data-panel");
    if (oldPanel) oldPanel.remove();

    const panel = document.createElement("div");
    panel.className = "panel analytics-data-panel";

    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>Zenodic Analytics</h2>
          <p>Statistics kutoka kwenye database halisi ya Zenodic</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div>
            <span>Total Users</span>
            <strong>${totalUsers}</strong>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">🧾</div>
          <div>
            <span>Total Orders</span>
            <strong>${totalOrders}</strong>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div>
            <span>Revenue</span>
            <strong>TZS ${revenue.toLocaleString()}</strong>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">⏳</div>
          <div>
            <span>Pending Orders</span>
            <strong>${pendingOrders}</strong>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div>
            <span>Completed Orders</span>
            <strong>${completedOrders}</strong>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">💳</div>
          <div>
            <span>Paid Orders</span>
            <strong>${paidOrders}</strong>
          </div>
        </div>
      </div>

      <div style="margin-top:24px;">
        <h3>Marketplace Overview</h3>
        <p>
          Products: ${Number(products.total || 0)}
          · Approved: ${Number(products.approved || 0)}
          · Pending: ${Number(products.pending || 0)}
          · Rejected: ${Number(products.rejected || 0)}
        </p>
      </div>
    `;

    analyticsSection.appendChild(panel);
  } catch (error) {
    console.error("Admin analytics error:", error);

    const oldPanel = analyticsSection.querySelector(".analytics-data-panel");
    if (oldPanel) oldPanel.remove();

    const panel = document.createElement("div");
    panel.className = "panel analytics-data-panel";
    panel.innerHTML = `
      <div class="empty">
        Imeshindikana kupakia dashboard statistics.
      </div>
    `;

    analyticsSection.appendChild(panel);
  }
}

function addAnalyticsCharts() {
  const analyticsSection =
    document.getElementById("analytics");

  if (!analyticsSection) return;

  const db = JSON.parse(
    localStorage.getItem("zenodicDB") || "{}"
  );

  const orders =
    Array.isArray(db.orders) ? db.orders : [];

  const paidOrders = orders.filter(function(order) {
    return String(order.paymentStatus || "").toLowerCase() === "paid";
  });

  const pendingOrders = orders.filter(function(order) {
    return String(order.status || "").toLowerCase() === "pending";
  });

  const completedOrders = orders.filter(function(order) {
    return String(order.status || "").toLowerCase() === "completed";
  });

  const revenue = paidOrders.reduce(function(sum, order) {
    return sum + Number(order.total || 0);
  }, 0);

  const oldCharts =
    analyticsSection.querySelector(".analytics-charts");

  if (oldCharts) oldCharts.remove();

  const charts = document.createElement("div");

  charts.className = "analytics-charts";

  charts.innerHTML = `
    <div class="panel analytics-chart-card">
      <div class="panel-header">
        <div>
          <h2>📦 Order Status</h2>
          <p>Muhtasari wa oda za Zenodic</p>
        </div>
      </div>

      <div class="analytics-bars">

        <div class="analytics-bar-row">
          <span>Pending</span>
          <div class="analytics-bar">
            <div class="analytics-bar-fill pending"
                 style="width:${orders.length ? (pendingOrders.length / orders.length) * 100 : 0}%">
            </div>
          </div>
          <strong>${pendingOrders.length}</strong>
        </div>

        <div class="analytics-bar-row">
          <span>Completed</span>
          <div class="analytics-bar">
            <div class="analytics-bar-fill completed"
                 style="width:${orders.length ? (completedOrders.length / orders.length) * 100 : 0}%">
            </div>
          </div>
          <strong>${completedOrders.length}</strong>
        </div>

        <div class="analytics-bar-row">
          <span>Paid</span>
          <div class="analytics-bar">
            <div class="analytics-bar-fill paid"
                 style="width:${orders.length ? (paidOrders.length / orders.length) * 100 : 0}%">
            </div>
          </div>
          <strong>${paidOrders.length}</strong>
        </div>

      </div>
    </div>

    <div class="panel analytics-chart-card">
      <div class="panel-header">
        <div>
          <h2>💰 Revenue Overview</h2>
          <p>Mapato kutokana na orders zilizolipwa</p>
        </div>
      </div>

      <div class="revenue-display">
        <span>Total Revenue</span>
        <strong>TZS ${revenue.toLocaleString()}</strong>
      </div>

      <div class="revenue-info">
        <div>
          <span>Orders</span>
          <strong>${orders.length}</strong>
        </div>

        <div>
          <span>Paid</span>
          <strong>${paidOrders.length}</strong>
        </div>

        <div>
          <span>Pending</span>
          <strong>${pendingOrders.length}</strong>
        </div>
      </div>
    </div>
  `;

  analyticsSection.appendChild(charts);
}

addAnalyticsCharts();
function addPaymentStatusChart() {
  const analyticsSection =
    document.getElementById("analytics");

  if (!analyticsSection) return;

  const db = JSON.parse(
    localStorage.getItem("zenodicDB") || "{}"
  );

  const orders =
    Array.isArray(db.orders) ? db.orders : [];

  const pending = orders.filter(function(order) {
    return String(order.paymentStatus || "pending")
      .toLowerCase() === "pending";
  }).length;

  const paid = orders.filter(function(order) {
    return String(order.paymentStatus || "")
      .toLowerCase() === "paid";
  }).length;

  const failed = orders.filter(function(order) {
    return String(order.paymentStatus || "")
      .toLowerCase() === "failed";
  }).length;

  const total = pending + paid + failed;

  const oldPanel =
    analyticsSection.querySelector(
      ".payment-status-panel"
    );

  if (oldPanel) oldPanel.remove();

  const panel = document.createElement("div");

  panel.className =
    "panel payment-status-panel";

  function percent(value) {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  }

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>💳 Payment Status</h2>
        <p>Muhtasari wa hali za malipo</p>
      </div>
    </div>

    <div class="payment-status-list">

      <div class="payment-status-row">
        <div class="payment-status-info">
          <span>⏳ Pending</span>
          <strong>${pending}</strong>
        </div>

        <div class="payment-status-bar">
          <div
            class="payment-status-fill pending"
            style="width:${percent(pending)}%"
          ></div>
        </div>

        <small>${percent(pending)}%</small>
      </div>

      <div class="payment-status-row">
        <div class="payment-status-info">
          <span>✅ Paid</span>
          <strong>${paid}</strong>
        </div>

        <div class="payment-status-bar">
          <div
            class="payment-status-fill paid"
            style="width:${percent(paid)}%"
          ></div>
        </div>

        <small>${percent(paid)}%</small>
      </div>

      <div class="payment-status-row">
        <div class="payment-status-info">
          <span>❌ Failed</span>
          <strong>${failed}</strong>
        </div>

        <div class="payment-status-bar">
          <div
            class="payment-status-fill failed"
            style="width:${percent(failed)}%"
          ></div>
        </div>

        <small>${percent(failed)}%</small>
      </div>

    </div>
  `;

  analyticsSection.appendChild(panel);
}

addPaymentStatusChart();
let analyticsDateRange = "7";
function addTopProductsAndSellers() {
  const analyticsSection = document.getElementById("analytics");

  if (!analyticsSection) return;

  const db = JSON.parse(
    localStorage.getItem("zenodicDB") || "{}"
  );

  const orders = Array.isArray(db.orders) ? db.orders : [];

  const productStats = {};
  const sellerStats = {};

orders.filter(function(order) {
    if (!order.createdAt) return false;

    const date = new Date(order.createdAt);

    if (isNaN(date.getTime())) return false;

    if (analyticsDateRange === "all") return true;

    let start = new Date();

    if (analyticsDateRange === "today") {
      start = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
      );
    }

    if (analyticsDateRange === "7") {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    }

    if (analyticsDateRange === "30") {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    }
    
return date >= start;
}).forEach(function(order) {
    const paymentStatus =
      String(order.paymentStatus || "").toLowerCase();

    if (paymentStatus !== "paid") return;

    if (!Array.isArray(order.items)) return;

    order.items.forEach(function(item) {
      const productName =
        String(item.name || "Unknown Product");

      const price =
        Number(item.price) || 0;

      const sellerId =
        item.sellerId || "unknown";

      const shopName =
        String(item.shopName || "Zenodic Seller");

      // -------------------------
      // TOP PRODUCTS
      // -------------------------

      if (!productStats[productName]) {
        productStats[productName] = {
          name: productName,
          sold: 0,
          revenue: 0
        };
      }

      productStats[productName].sold += 1;
      productStats[productName].revenue += price;

      // -------------------------
      // TOP SELLERS
      // -------------------------

      const sellerKey =
        String(sellerId);

      if (!sellerStats[sellerKey]) {
        sellerStats[sellerKey] = {
          sellerId: sellerId,
          shopName: shopName,
          sold: 0,
          revenue: 0
        };
      }

      sellerStats[sellerKey].sold += 1;
      sellerStats[sellerKey].revenue += price;
    });
  });

  const topProducts =
    Object.values(productStats)
      .sort(function(a, b) {
        return b.sold - a.sold ||
               b.revenue - a.revenue;
      })
      .slice(0, 5);

  const topSellers =
    Object.values(sellerStats)
      .sort(function(a, b) {
        return b.revenue - a.revenue ||
               b.sold - a.sold;
      })
      .slice(0, 5);

  const oldPanel =
    analyticsSection.querySelector(
      ".top-products-sellers-panel"
    );

  if (oldPanel) oldPanel.remove();

  const panel =
    document.createElement("div");

  panel.className =
    "panel top-products-sellers-panel";

  const productRows =
    topProducts.length
      ? topProducts.map(function(product, index) {
          return `
            <tr>
              <td>🏆 ${index + 1}</td>
              <td>${escapeHTML(product.name)}</td>
              <td>${product.sold}</td>
              <td>
                TZS ${product.revenue.toLocaleString()}
              </td>
            </tr>
          `;
        }).join("")
      : `
        <tr>
          <td colspan="4">
            Hakuna bidhaa zilizouzwa bado.
          </td>
        </tr>
      `;

  const sellerRows =
    topSellers.length
      ? topSellers.map(function(seller, index) {
          return `
            <tr>
              <td>🏆 ${index + 1}</td>
              <td>${escapeHTML(seller.shopName)}</td>
              <td>${seller.sold}</td>
              <td>
                TZS ${seller.revenue.toLocaleString()}
              </td>
            </tr>
          `;
        }).join("")
      : `
        <tr>
          <td colspan="4">
            Hakuna sellers waliofanya sale bado.
          </td>
        </tr>
      `;

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>🏆 Top Products & Sellers</h2>
        <p>
          Bidhaa na maduka yanayofanya vizuri zaidi
        </p>
      </div>
    </div>

    <div class="top-performance-grid">

      <div class="top-performance-card">
        <h3>🛍️ Top Products</h3>

        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>

            <tbody>
              ${productRows}
            </tbody>
          </table>
        </div>
      </div>

      <div class="top-performance-card">
        <h3>🏪 Top Sellers</h3>

        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr>
                <th>#</th>
                <th>Shop</th>
                <th>Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>

            <tbody>
              ${sellerRows}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  analyticsSection.appendChild(panel);
}

addTopProductsAndSellers();
function addOrdersTrendChart() {
  const analyticsSection =
    document.getElementById("analytics");

  if (!analyticsSection) return;

  const db = JSON.parse(
    localStorage.getItem("zenodicDB") || "{}"
  );

  const orders =
    Array.isArray(db.orders) ? db.orders : [];

const today = new Date();

let numberOfDays = 7;

if (analyticsDateRange === "today") {
  numberOfDays = 1;
} else if (analyticsDateRange === "30") {
  numberOfDays = 30;
} else if (analyticsDateRange === "all") {
  numberOfDays = 30;
}

const days = [];

for (let i = numberOfDays - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    days.push({
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short"
      }),
      orders: 0,
      revenue: 0
    });
  }

  orders.forEach(function(order) {
    if (!order.createdAt) return;

    const date = new Date(order.createdAt);

    if (isNaN(date.getTime())) return;

    const key =
      date.toISOString().slice(0, 10);

    const day = days.find(function(item) {
      return item.key === key;
    });

    if (!day) return;

    day.orders += 1;

    if (
      String(order.paymentStatus || "")
        .toLowerCase() === "paid"
    ) {
      day.revenue += Number(order.total || 0);
    }
  });

  const maxOrders = Math.max(
    ...days.map(function(day) {
      return day.orders;
    }),
    1
  );

  const maxRevenue = Math.max(
    ...days.map(function(day) {
      return day.revenue;
    }),
    1
  );

  const oldTrend =
    analyticsSection.querySelector(
      ".analytics-trend-panel"
    );

  if (oldTrend) oldTrend.remove();

  const panel =
    document.createElement("div");

  panel.className =
    "panel analytics-trend-panel";

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>📈 Orders & Revenue Trend</h2>
        <p>Performance ya siku 7 zilizopita</p>
      </div>
    </div>

    <div class="trend-section">
      <h3>🧾 Orders kwa siku</h3>

      <div class="trend-chart">
        ${days.map(function(day) {
          const height =
            (day.orders / maxOrders) * 100;

          return `
            <div class="trend-column">
              <strong>${day.orders}</strong>

              <div class="trend-bar-area">
                <div
                  class="trend-bar"
                  style="height:${height}%"
                ></div>
              </div>

              <small>${day.label}</small>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <div class="trend-section">
      <h3>💰 Revenue kwa siku</h3>

      <div class="trend-chart revenue-trend">
        ${days.map(function(day) {
          const height =
            (day.revenue / maxRevenue) * 100;

          return `
            <div class="trend-column">
              <strong>
                ${day.revenue.toLocaleString()}
              </strong>

              <div class="trend-bar-area">
                <div
                  class="trend-bar revenue-bar"
                  style="height:${height}%"
                ></div>
              </div>

              <small>${day.label}</small>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  analyticsSection.appendChild(panel);
}

addOrdersTrendChart();

function saveNotificationSettings() {
  const notificationsEl = document.getElementById("notificationsEnabled");
  const messageEl = document.getElementById("notificationSettingsMessage");
  const button = document.getElementById("saveNotificationSettingsBtn");

  if (!notificationsEl || !button) return;

  const settings = JSON.parse(
    localStorage.getItem("zenodic_admin_settings") || "{}"
  );

  settings.notifications = notificationsEl.checked;

  localStorage.setItem(
    "zenodic_admin_settings",
    JSON.stringify(settings)
  );

  button.disabled = true;
  button.textContent = "Saving...";

  if (messageEl) {
    messageEl.textContent = "Notification settings zimehifadhiwa.";
    messageEl.classList.remove("error");
  }

  setTimeout(function() {
    button.disabled = false;
    button.textContent = "🔔 Save Notifications";
  }, 700);
}


function loadSettings() {
  const settings = JSON.parse(
    localStorage.getItem("zenodic_admin_settings") || "{}"
  );

  const name = document.getElementById("dashboardName");
  const currency = document.getElementById("currency");
  const notifications = document.getElementById("notificationsEnabled");
  const theme = document.getElementById("dashboardTheme");

  if (name && settings.name) name.value = settings.name;
  if (currency && settings.currency) currency.value = settings.currency;
  if (notifications && typeof settings.notifications === "boolean") {
    notifications.checked = settings.notifications;
  }
  if (theme && settings.theme) {
    theme.value = settings.theme;
    document.body.classList.toggle("dark-theme", settings.theme === "dark");
  }
}

function saveSettings() {
  const settings = {
    name: document.getElementById("dashboardName")?.value.trim() || "Zenodic Admin",
    currency: document.getElementById("currency")?.value || "TZS",
    notifications: document.getElementById("notificationsEnabled")?.checked ?? true,
    theme: document.getElementById("dashboardTheme")?.value || "light"
  };

  localStorage.setItem(
    "zenodic_admin_settings",
    JSON.stringify(settings)
  );

  document.body.classList.toggle(
    "dark-theme",
    settings.theme === "dark"
  );

  const message = document.getElementById("settingsMessage");

  if (message) {
    message.textContent = "✅ Settings zimehifadhiwa.";
    setTimeout(() => {
      message.textContent = "";
    }, 2500);
  }
}

document
  .getElementById("saveSettingsBtn")
  ?.addEventListener("click", saveSettings);


const saveNotificationSettingsBtn = document.getElementById(
  "saveNotificationSettingsBtn"
);

if (saveNotificationSettingsBtn) {
  saveNotificationSettingsBtn.addEventListener(
    "click",
    saveNotificationSettings
  );
}

loadSettings();

function addSalesPerformance() {
  const analyticsSection =
    document.getElementById("analytics");

  if (!analyticsSection) return;

  const db = JSON.parse(
    localStorage.getItem("zenodicDB") || "{}"
  );

  const orders =
    Array.isArray(db.orders) ? db.orders : [];

  const oldPanel =
    analyticsSection.querySelector(
      ".sales-performance-panel"
    );

  if (oldPanel) oldPanel.remove();

  const panel =
    document.createElement("div");

  panel.className =
    "panel sales-performance-panel";

  function getRangeStart(range) {
    const now = new Date();

    if (range === "today") {
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
    }

    if (range === "7") {
      const date = new Date();
      date.setDate(date.getDate() - 6);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    if (range === "30") {
      const date = new Date();
      date.setDate(date.getDate() - 29);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    return null;
  }

  function render(range) {
    const start =
      getRangeStart(range);

    const filteredOrders =
      orders.filter(function(order) {
        if (!order.createdAt) return false;

        const date =
          new Date(order.createdAt);

if (isNaN(date.getTime())) return false;

if (range === "custom") {
  const from =
    panel.querySelector("#exportCustomFrom").value;

  const to =
    panel.querySelector("#exportCustomTo").value;

  if (!from || !to) return false;

  const fromDate =
    new Date(from + "T00:00:00");

  const toDate =
    new Date(to + "T23:59:59");

  return date >= fromDate && date <= toDate;
}

if (!start) return true;

return date >= start;
      });

    const paidOrders =
      filteredOrders.filter(function(order) {
        return String(
          order.paymentStatus || ""
        ).toLowerCase() === "paid";
      });

    const revenue =
      paidOrders.reduce(function(sum, order) {
        return sum +
          Number(order.total || 0);
      }, 0);

    const averageOrder =
      paidOrders.length
        ? revenue / paidOrders.length
        : 0;

    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>📊 Sales Performance</h2>
          <p>Muhtasari wa mauzo kwa kipindi ulichochagua</p>
        </div>

        <select
          id="salesPerformanceRange"
          style="
            padding:8px 12px;
            border-radius:8px;
            border:1px solid #ddd;
          "
        >
          <option value="today"
            ${range === "today" ? "selected" : ""}>
            Today
          </option>

          <option value="7"
            ${range === "7" ? "selected" : ""}>
            Last 7 Days
          </option>

          <option value="30"
            ${range === "30" ? "selected" : ""}>
            Last 30 Days
          </option>

          <option value="all"
            ${range === "all" ? "selected" : ""}>
            All Time
          </option>
        </select>
      </div>

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(180px,1fr));
          gap:16px;
          margin-top:20px;
        "
      >

        <div class="analytics-stat-card">
          <span>🧾 Total Orders</span>
          <strong>
            ${filteredOrders.length}
          </strong>
        </div>

        <div class="analytics-stat-card">
          <span>✅ Paid Orders</span>
          <strong>
            ${paidOrders.length}
          </strong>
        </div>

        <div class="analytics-stat-card">
          <span>💰 Revenue</span>
          <strong>
            TZS ${revenue.toLocaleString()}
          </strong>
        </div>

        <div class="analytics-stat-card">
          <span>📦 Average Order</span>
          <strong>
            TZS ${Math.round(
              averageOrder
            ).toLocaleString()}
          </strong>
        </div>

      </div>
    `;

    const select =
      panel.querySelector(
        "#salesPerformanceRange"
      );

    if (select) {
      select.addEventListener(
        "change",
        function() {
analyticsDateRange = this.value;

render(analyticsDateRange);

addTopProductsAndSellers();
addOrdersTrendChart();
addSellerPerformance();
        }
      );
    }
  }

  render("7");

  analyticsSection.appendChild(panel);
}

addSalesPerformance();
function addSellerPerformance() {
  const analyticsSection =
    document.getElementById("analytics");

  if (!analyticsSection) return;

  const db = JSON.parse(
    localStorage.getItem("zenodicDB") || "{}"
  );

  const orders =
    Array.isArray(db.orders) ? db.orders : [];

  const sellerStats = {};

  orders.forEach(function(order) {
    if (
      String(order.paymentStatus || "")
        .toLowerCase() !== "paid"
    ) {
      return;
    }

    if (!Array.isArray(order.items)) return;

    const orderSellerIds = {};

    order.items.forEach(function(item) {
      const sellerId =
        String(item.sellerId || "unknown");

      const shopName =
        String(
          item.shopName ||
          "Zenodic Seller"
        );

      const price =
        Number(item.price) || 0;

      if (!sellerStats[sellerId]) {
        sellerStats[sellerId] = {
          sellerId: sellerId,
          shopName: shopName,
          orders: 0,
          sold: 0,
          revenue: 0
        };
      }

      sellerStats[sellerId].sold += 1;
      sellerStats[sellerId].revenue += price;

      orderSellerIds[sellerId] = true;
    });

    Object.keys(orderSellerIds)
      .forEach(function(sellerId) {
        if (sellerStats[sellerId]) {
          sellerStats[sellerId].orders += 1;
        }
      });
  });

  const sellers =
    Object.values(sellerStats)
      .sort(function(a, b) {
        return (
          b.revenue - a.revenue ||
          b.orders - a.orders ||
          b.sold - a.sold
        );
      });

  const oldPanel =
    analyticsSection.querySelector(
      ".seller-performance-panel"
    );

  if (oldPanel) oldPanel.remove();

  const panel =
    document.createElement("div");

  panel.className =
    "panel seller-performance-panel";

  function render(filter) {
    let filtered = sellers;

    if (filter) {
      filtered =
        sellers.filter(function(seller) {
          return seller.shopName === filter;
        });
    }

    const rows =
      filtered.length
        ? filtered.map(function(seller, index) {
            return `
              <tr>
                <td>
                  ${
                    index === 0 && !filter
                      ? "🥇"
                      : index === 1 && !filter
                      ? "🥈"
                      : index === 2 && !filter
                      ? "🥉"
                      : index + 1
                  }
                </td>

                <td>
                  <strong>
                    ${escapeHTML(
                      seller.shopName
                    )}
                  </strong>
                </td>

                <td>
                  ${seller.orders}
                </td>

                <td>
                  ${seller.sold}
                </td>

                <td>
                  TZS ${seller.revenue.toLocaleString()}
                </td>
              </tr>
            `;
          }).join("")
        : `
            <tr>
              <td colspan="5">
                Hakuna seller aliye na sales bado.
              </td>
            </tr>
          `;

    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>🏪 Seller Performance</h2>
          <p>
            Performance ya sellers kwa orders na revenue
          </p>
        </div>

        <select
          id="sellerPerformanceFilter"
          style="
            padding:8px 12px;
            border-radius:8px;
            border:1px solid #ddd;
          "
        >
          <option value="">
            All Sellers
          </option>

          ${sellers.map(function(seller) {
            return `
              <option
                value="${escapeHTML(
                  seller.shopName
                )}"
                ${
                  filter === seller.shopName
                    ? "selected"
                    : ""
                }
              >
                ${escapeHTML(
                  seller.shopName
                )}
              </option>
            `;
          }).join("")}
        </select>
      </div>

      <div style="overflow-x:auto;">
        <table
          style="
            width:100%;
            border-collapse:collapse;
            margin-top:20px;
          "
        >
          <thead>
            <tr>
              <th>Rank</th>
              <th>Shop</th>
              <th>Orders</th>
              <th>Items Sold</th>
              <th>Revenue</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;

    const select =
      panel.querySelector(
        "#sellerPerformanceFilter"
      );

 if (select) {
      select.addEventListener(
        "change",
        function() {
          render(this.value);
        }
      );
    }
  }

  render("");

  analyticsSection.appendChild(panel);
}

addSellerPerformance();


function addSalesExport() {
  const analyticsSection =
    document.getElementById("analytics");

  if (!analyticsSection) return;

  const oldPanel =
    analyticsSection.querySelector(".sales-export-panel");

  if (oldPanel) oldPanel.remove();

  const panel = document.createElement("div");

  panel.className = "panel sales-export-panel";

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>📥 Sales Reports</h2>
        <p>Pakua orders kulingana na kipindi</p>
      </div>
    </div>

    <div style="
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      margin-top:20px;
    ">


<select
  id="exportSalesRange"
  style="
    padding:12px;
    border-radius:8px;
    border:1px solid #ddd;
  "
>
  <option value="today">Today</option>
  <option value="7" selected>Last 7 Days</option>
  <option value="30">Last 30 Days</option>
  <option value="custom">Custom Range</option>
  <option value="all">All Time</option>
</select>
<div
  id="exportCustomDateRange"
  style="display:none; gap:8px; flex-wrap:wrap;"
>
  <label>
    From
    <input type="date" id="exportCustomFrom">
  </label>

  <label>
    To
    <input type="date" id="exportCustomTo">
  </label>
</div>
      <button
        id="exportSalesCSV"
        type="button"
        style="
          padding:12px 18px;
          border:0;
          border-radius:8px;
          cursor:pointer;
          font-weight:600;
        "
      >
        📥 Export Sales CSV
      </button>

    </div>
  `;

  analyticsSection.appendChild(panel);

  const exportButton =
    panel.querySelector("#exportSalesCSV");

  const rangeSelect =
    panel.querySelector("#exportSalesRange");
const customDateRange =
  panel.querySelector("#exportCustomDateRange");

if (rangeSelect) {
  rangeSelect.addEventListener("change", function() {
    if (customDateRange) {
      customDateRange.style.display =
        this.value === "custom" ? "flex" : "none";
    }
  });
}
  function getRangeStart(range) {
    const now = new Date();

    if (range === "today") {
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
    }

    if (range === "7") {
      const date = new Date();
      date.setDate(date.getDate() - 6);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    if (range === "30") {
      const date = new Date();
      date.setDate(date.getDate() - 29);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    return null;
  }

  exportButton.addEventListener(
    "click",
    function() {

      const db = JSON.parse(
        localStorage.getItem("zenodicDB") || "{}"
      );

      const orders =
        Array.isArray(db.orders)
          ? db.orders
          : [];

      const range =
        rangeSelect.value;

      const start =
        getRangeStart(range);

      const filteredOrders =
        orders.filter(function(order) {

          if (!order.createdAt) {
            return false;
          }

          const date =
            new Date(order.createdAt);

          if (isNaN(date.getTime())) {
            return false;
          }

          if (!start) {
            return true;
          }

          return date >= start;
        });

      if (!filteredOrders.length) {
        alert(
          "Hakuna orders kwenye kipindi hiki."
        );
        return;
      }

      const rows = [];

      rows.push([
        "Order ID",
        "Customer",
        "Product",
        "Seller ID",
        "Shop",
        "Price",
        "Payment Status",
        "Order Status",
        "Date"
      ]);

      filteredOrders.forEach(function(order) {

        const items =
          Array.isArray(order.items)
            ? order.items
            : [];

        if (!items.length) {

          rows.push([
            order.id || "",
            order.customerName || "",
            "",
            "",
            "",
            Number(order.total || 0),
            order.paymentStatus || "pending",
            order.status || "pending",
            order.createdAt || ""
          ]);

          return;
        }

        items.forEach(function(item) {

          rows.push([
            order.id || "",
            order.customerName || "",
            item.name || "",
            item.sellerId || "",
            item.shopName || "",
            Number(item.price || 0),
            order.paymentStatus || "pending",
            order.status || "pending",
            order.createdAt || ""
          ]);

        });
      });

      const totalOrders = filteredOrders.length;

const totalSales = filteredOrders.reduce(
  function(total, order) {
    return total + Number(order.total || 0);
  },
  0
);

const totalProductsSold = filteredOrders.reduce(
  function(total, order) {
    const items =
      Array.isArray(order.items)
        ? order.items
        : [];

    return total + items.length;
  },
  0
);

const averageOrderValue =
  totalOrders > 0
    ? totalSales / totalOrders
    : 0;

rows.unshift(
  ["Total Sales", totalSales],
  ["Total Orders", totalOrders],
  ["Total Products Sold", totalProductsSold],
  ["Average Order Value", averageOrderValue],
  []
);
const csv =
        rows.map(function(row) {

          return row.map(function(value) {

            const text =
              String(value ?? "");

            return `"${text.replaceAll('"', '""')}"`;

          }).join(",");

        }).join("\n");

      const blob =
        new Blob(
          [csv],
          {
            type:
              "text/csv;charset=utf-8;"
          }
        );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        "zenodic-sales-" +
        range +
        "-" +
        new Date()
          .toISOString()
          .slice(0, 10) +
        ".csv";

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    }
  );
}

addSalesExport();


// =====================================================
// COMMISSION SETTINGS
// =====================================================

function getCommissionRate() {
  const rate = Number(
    localStorage.getItem("zenodic_commission_rate")
  );

  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return 5;
  }

  return rate;
}

async function saveCommissionRate(rate) {
  const value = Number(rate);

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    alert("Commission lazima iwe kati ya 0% na 100%.");
    return false;
  }

  try {
    const response = await fetch(
      "/api/admin/management/settings",
      {
        method: "PATCH",
        headers: {
          ...getAdminHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          commission_rate: value
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kuhifadhi commission rate."
      );
    }

    localStorage.setItem(
      "zenodic_commission_rate",
      String(value)
    );

    return true;
  } catch (error) {
    console.error("Commission rate save error:", error);
    alert(
      error.message ||
      "Imeshindikana kuhifadhi commission rate."
    );
    return false;
  }
}

function showCommissionSettings() {
  const analyticsSection =
    document.querySelector("#analytics");

  if (!analyticsSection) return;

  const oldPanel =
    analyticsSection.querySelector(".commission-settings-panel");

  if (oldPanel) oldPanel.remove();

  const panel =
    document.createElement("div");

  panel.className =
    "panel commission-settings-panel";

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>💰 Commission Settings</h2>
        <p>Weka asilimia ya commission ya admin</p>
      </div>
    </div>

    <div style="
      display:flex;
      gap:12px;
      align-items:end;
      flex-wrap:wrap;
      margin-top:20px;
    ">
      <label style="display:flex; flex-direction:column; gap:6px;">
        Commission Rate (%)
        <input
          id="commissionRateInput"
          type="number"
          min="0"
          max="100"
          step="0.1"
          value="${getCommissionRate()}"
          style="
            padding:12px;
            border-radius:8px;
            border:1px solid #ddd;
            width:180px;
          "
        >
      </label>

      <button
        id="saveCommissionRate"
        type="button"
        style="
          padding:12px 18px;
          border:0;
          border-radius:8px;
          cursor:pointer;
          font-weight:600;
        "
      >
        💾 Save Commission
      </button>
    </div>
  `;

  analyticsSection.appendChild(panel);

  const input =
    panel.querySelector("#commissionRateInput");

  const button =
    panel.querySelector("#saveCommissionRate");

  if (button && input) {
    button.addEventListener("click", async function() {
      if (await saveCommissionRate(input.value)) {
        alert(
          "✅ Commission rate imehifadhiwa: " +
          getCommissionRate() +
          "%"
        );
      }
    });
  }
}

showCommissionSettings();

// =====================================================
// COMMISSION REPORTS
// =====================================================

function addCommissionReports() {
  const analyticsSection =
    document.getElementById("analytics");

  if (!analyticsSection) return;

  const oldPanel =
    analyticsSection.querySelector(".commission-reports-panel");

  if (oldPanel) oldPanel.remove();

  const panel =
    document.createElement("div");

  panel.className =
    "panel commission-reports-panel";

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>💰 Commission Reports</h2>
        <p>Commission ya orders zilizolipwa</p>
      </div>
    </div>

    <div style="
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      margin-top:20px;
    ">
      <select
        id="commissionReportRange"
        style="
          padding:12px;
          border-radius:8px;
          border:1px solid #ddd;
        "
      >
        <option value="today">Today</option>
        <option value="7" selected>Last 7 Days</option>
        <option value="30">Last 30 Days</option>
        <option value="custom">Custom Range</option>
        <option value="all">All Time</option>
      </select>

      <div
        id="commissionCustomRange"
        style="display:none; gap:8px; flex-wrap:wrap;"
      >
        <label>
          From
          <input type="date" id="commissionFrom">
        </label>

        <label>
          To
          <input type="date" id="commissionTo">
        </label>
      </div>
    </div>

    <div
      id="commissionSummary"
      style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
        gap:15px;
        margin-top:20px;
      "
    ></div>

    <div style="margin-top:20px;">
      <button
        id="exportCommissionCSV"
        type="button"
        style="
          padding:12px 18px;
          border:0;
          border-radius:8px;
          cursor:pointer;
          font-weight:600;
        "
      >
        📥 Export Commission CSV
      </button>
    </div>
  `;

  analyticsSection.appendChild(panel);

  const rangeSelect =
    panel.querySelector("#commissionReportRange");

  const customRange =
    panel.querySelector("#commissionCustomRange");

  const fromInput =
    panel.querySelector("#commissionFrom");

  const toInput =
    panel.querySelector("#commissionTo");

  const summary =
    panel.querySelector("#commissionSummary");

  function getStartDate(range) {
    const now = new Date();

    if (range === "today") {
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
    }

    if (range === "7") {
      const date = new Date();
      date.setDate(date.getDate() - 6);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    if (range === "30") {
      const date = new Date();
      date.setDate(date.getDate() - 29);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    return null;
  }

  function getCommissionOrders() {
    const db = JSON.parse(
      localStorage.getItem("zenodicDB") || "{}"
    );

    const orders =
      Array.isArray(db.orders)
        ? db.orders
        : [];

    const paidOrders =
      orders.filter(function(order) {
        return String(
          order.paymentStatus || ""
        ).toLowerCase() === "paid";
      });

    const range =
      rangeSelect.value;

    const start =
      getStartDate(range);

    return paidOrders.filter(function(order) {
      if (!order.createdAt) return false;

      const date =
        new Date(order.createdAt);

      if (isNaN(date.getTime())) {
        return false;
      }

      if (range === "custom") {
        const from =
          fromInput.value
            ? new Date(fromInput.value + "T00:00:00")
            : null;

        const to =
          toInput.value
            ? new Date(toInput.value + "T23:59:59")
            : null;

        if (from && date < from) return false;
        if (to && date > to) return false;

        return true;
      }

      if (!start) return true;

      return date >= start;
    });
  }

  function renderCommissionReport() {
    const orders =
      getCommissionOrders();

    const rate =
      getCommissionRate();

    const totalSales =
      orders.reduce(function(sum, order) {
        return sum + Number(order.total || 0);
      }, 0);

    const totalCommission =
      totalSales * rate / 100;

    const sellerEarnings =
      totalSales - totalCommission;

    summary.innerHTML = `
      <div class="stat-card">
        <span>💵 Total Sales</span>
        <strong>
          TSh ${totalSales.toLocaleString()}
        </strong>
      </div>

      <div class="stat-card">
        <span>🧾 Commissionable Orders</span>
        <strong>${orders.length}</strong>
      </div>

      <div class="stat-card">
        <span>📊 Commission Rate</span>
        <strong>${rate}%</strong>
      </div>

      <div class="stat-card">
        <span>💰 Total Commission</span>
        <strong>
          TSh ${totalCommission.toLocaleString()}
        </strong>
      </div>

      <div class="stat-card">
        <span>🏪 Seller Earnings</span>
        <strong>
          TSh ${sellerEarnings.toLocaleString()}
        </strong>
      </div>
    `;


    // =====================================================
    // SELLER COMMISSION BREAKDOWN
    // =====================================================

    let breakdown =
      panel.querySelector(
        ".seller-commission-breakdown"
      );

    if (breakdown) {
      breakdown.remove();
    }

    breakdown =
      document.createElement("div");

    breakdown.className =
      "panel seller-commission-breakdown";

    const sellerMap = {};

    orders.forEach(function(order) {

      const orderTotal =
        Number(order.total || 0);

      const items =
        Array.isArray(order.items)
          ? order.items
          : [];

      if (!items.length) {
        return;
      }

      // Gawanya order kwa seller kulingana na items
      const sellerTotals = {};

      items.forEach(function(item) {

        const sellerId =
          String(
            item.sellerId ||
            "unknown"
          );

        const shopName =
          String(
            item.shopName ||
            "Zenodic Seller"
          );

        const price =
          Number(item.price || 0);

        if (!sellerTotals[sellerId]) {
          sellerTotals[sellerId] = {
            sellerId,
            shopName,
            total: 0
          };
        }

        sellerTotals[sellerId].total += price;
      });

      Object.keys(sellerTotals).forEach(
        function(sellerId) {

          const seller =
            sellerTotals[sellerId];

          if (!sellerMap[sellerId]) {
            sellerMap[sellerId] = {
              sellerId:
                seller.sellerId,

              shopName:
                seller.shopName,

              sales: 0,

              orders: 0
            };
          }

          /*
           * Seller anapewa sehemu yake ya order
           * kulingana na items zake.
           */
          sellerMap[sellerId].sales +=
            seller.total;

          sellerMap[sellerId].orders +=
            1;
        }
      );
    });

    const sellerRows =
      Object.values(sellerMap)
        .sort(function(a, b) {
          return b.sales - a.sales;
        })
        .map(function(seller) {

          const commission =
            seller.sales *
            rate /
            100;

          const net =
            seller.sales -
            commission;

          return `
            <tr>
              <td>
                ${escapeHTML(
                  seller.shopName
                )}
              </td>

              <td>
                ${escapeHTML(
                  seller.sellerId
                )}
              </td>

              <td>
                ${seller.orders}
              </td>

              <td>
                TSh ${seller.sales.toLocaleString()}
              </td>

              <td>
                ${rate}%
              </td>

              <td>
                TSh ${commission.toLocaleString()}
              </td>

              <td>
                TSh ${net.toLocaleString()}
              </td>
            </tr>
          `;
        })
        .join("");

    breakdown.innerHTML = `
      <div class="panel-header">
        <div>
          <h2>🏪 Seller Commission Breakdown</h2>

          <p>
            Commission ya kila seller kutoka
            kwenye paid orders
          </p>
        </div>
      </div>

      <div style="overflow-x:auto;">

        ${
          sellerRows
            ? `
              <table
                style="
                  width:100%;
                  border-collapse:collapse;
                  margin-top:15px;
                "
              >

                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Seller ID</th>
                    <th>Paid Orders</th>
                    <th>Total Sales</th>
                    <th>Commission</th>
                    <th>Admin Commission</th>
                    <th>Net Earnings</th>
                  </tr>
                </thead>

                <tbody>
                  ${sellerRows}
                </tbody>

              </table>
            `
            : `
              <div class="empty">
                Hakuna paid seller sales kwenye
                kipindi hiki.
              </div>
            `
        }

      </div>
    `;

    analyticsSection.appendChild(
      breakdown
    );

    return {
      orders,
      rate,
      totalSales,
      totalCommission,
      sellerEarnings
    };
  }

  rangeSelect.addEventListener(
    "change",
    function() {
      customRange.style.display =
        this.value === "custom"
          ? "flex"
          : "none";

      renderCommissionReport();
    }
  );

  if (fromInput) {
    fromInput.addEventListener(
      "change",
      renderCommissionReport
    );
  }

  if (toInput) {
    toInput.addEventListener(
      "change",
      renderCommissionReport
    );
  }

  const exportButton =
    panel.querySelector("#exportCommissionCSV");

  exportButton.addEventListener(
    "click",
    function() {
      const report =
        renderCommissionReport();

      if (!report.orders.length) {
        alert(
          "Hakuna paid orders kwenye kipindi hiki."
        );
        return;
      }

      const rows = [
        ["Commission Rate", report.rate + "%"],
        ["Total Sales", report.totalSales],
        ["Commissionable Orders", report.orders.length],
        ["Total Commission", report.totalCommission],
        ["Seller Earnings", report.sellerEarnings],
        []
      ];

      rows.push([
        "Order ID",
        "Customer",
        "Order Total",
        "Commission",
        "Seller Earnings",
        "Payment Status",
        "Date"
      ]);

      report.orders.forEach(function(order) {
        const orderTotal =
          Number(order.total || 0);

        const commission =
          orderTotal * report.rate / 100;

        const sellerEarning =
          orderTotal - commission;

        rows.push([
          order.id || "",
          order.customerName || "",
          orderTotal,
          commission,
          sellerEarning,
          order.paymentStatus || "",
          order.createdAt || ""
        ]);
      });

      const csv =
        rows.map(function(row) {
          return row.map(function(value) {
            const text =
              String(value ?? "");

            return `"${text.replaceAll('"', '""')}"`;
          }).join(",");
        }).join("\n");

      const blob =
        new Blob(
          [csv],
          {
            type:
              "text/csv;charset=utf-8;"
          }
        );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        "zenodic-commission-" +
        rangeSelect.value +
        "-" +
        new Date()
          .toISOString()
          .slice(0, 10) +
        ".csv";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    }
  );

  renderCommissionReport();
}

addCommissionReports();




function renderSalesPerformance(orders) {
  const container = document.getElementById("adminSalesPerformance");
  if (!container) return;

  const total = Number(orders.total || 0);
  const pending = Number(orders.pending || 0);
  const completed = Number(orders.completed || 0);
  const paid = Number(orders.paid || 0);
  const revenue = Number(orders.revenue || 0);

  const completionRate =
    total > 0 ? Math.round((completed / total) * 100) : 0;

  const paymentRate =
    total > 0 ? Math.round((paid / total) * 100) : 0;

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">🧾</div>
      <div>
        <span>Total Orders</span>
        <strong>${total.toLocaleString()}</strong>
        <small>Orders zote</small>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">⏳</div>
      <div>
        <span>Pending Orders</span>
        <strong>${pending.toLocaleString()}</strong>
        <small>Bado zinaendelea</small>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">✅</div>
      <div>
        <span>Completed Orders</span>
        <strong>${completed.toLocaleString()}</strong>
        <small>${completionRate}% completion rate</small>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">💳</div>
      <div>
        <span>Paid Orders</span>
        <strong>${paid.toLocaleString()}</strong>
        <small>${paymentRate}% payment rate</small>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">💰</div>
      <div>
        <span>Revenue</span>
        <strong>TSh ${revenue.toLocaleString()}</strong>
        <small>Paid sales</small>
      </div>
    </div>
  `;
}

function renderOrderOverview(users, products, orders) {
  const container = document.getElementById("adminOverviewDetails");
  if (!container) return;

  const pending = Number(orders.pending || 0);
  const completed = Number(orders.completed || 0);
  const paid = Number(orders.paid || 0);
  const total = Number(orders.total || 0);

  const productTotal = Number(products.total || 0);
  const approvedProducts = Number(products.approved || 0);
  const pendingProducts = Number(products.pending || 0);

  container.innerHTML = `
    <div class="overview-grid">
      <div class="overview-item">
        <span>🧾 Total Orders</span>
        <strong>${total.toLocaleString()}</strong>
      </div>

      <div class="overview-item">
        <span>⏳ Pending</span>
        <strong>${pending.toLocaleString()}</strong>
      </div>

      <div class="overview-item">
        <span>✅ Completed</span>
        <strong>${completed.toLocaleString()}</strong>
      </div>

      <div class="overview-item">
        <span>💳 Paid</span>
        <strong>${paid.toLocaleString()}</strong>
      </div>

      <div class="overview-item">
        <span>📦 Products</span>
        <strong>${productTotal.toLocaleString()}</strong>
      </div>

      <div class="overview-item">
        <span>✅ Approved Products</span>
        <strong>${approvedProducts.toLocaleString()}</strong>
      </div>

      <div class="overview-item">
        <span>⏳ Pending Products</span>
        <strong>${pendingProducts.toLocaleString()}</strong>
      </div>

      <div class="overview-item">
        <span>👥 Users</span>
        <strong>${Number(users.total || 0).toLocaleString()}</strong>
      </div>
    </div>
  `;
}

async function loadOverviewStats() {
  try {
    const token = sessionStorage.getItem("zenodicAdminToken");

    const response = await fetch(`${API}/api/admin/management/stats`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kupata dashboard statistics."
      );
    }

    const users = data.stats?.users || {};
    const products = data.stats?.products || {};
    const orders = data.stats?.orders || {};

    renderOrderOverview(users, products, orders);
    renderSalesPerformance(orders);

    const totalUsers = Number(users.total || 0);
    const totalSellers =
      Number(users.sellers || 0) + Number(users.wholesalers || 0);
    const totalOrders = Number(orders.total || 0);
    const totalSales = Number(orders.revenue || 0);
    const paidOut = Number(data.stats?.payouts?.paid_out || 0);
    const pendingPayout = Number(data.stats?.payouts?.pending_payout || 0);
    const commission = Number(data.stats?.commissions?.commission || 0);
    const netRevenue = commission;

    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    setText("totalUsers", totalUsers.toLocaleString());
    setText("totalSellers", totalSellers.toLocaleString());
    setText("totalOrders", totalOrders.toLocaleString());
    setText("totalSales", `TSh ${totalSales.toLocaleString()}`);
    setText("paidOut", `TSh ${paidOut.toLocaleString()}`);
    setText("commission", `TSh ${commission.toLocaleString()}`);
    setText("netRevenue", `TSh ${netRevenue.toLocaleString()}`);
    setText("pendingPayout", `TSh ${pendingPayout.toLocaleString()}`);

    console.log("ADMIN OVERVIEW STATS:", {
      totalUsers,
      totalSellers,
      totalOrders,
      totalSales
    });
  } catch (error) {
    console.error("ADMIN OVERVIEW ERROR:", error);
  }
}


/* ================= ADMIN NOTIFICATIONS ================= */

let adminNotificationFilter = "all";

function escapeAdminNotificationHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function adminNotificationPriorityClass(priority) {
  const value = String(priority || "normal").toLowerCase();

  if (value === "critical") return "critical";
  if (value === "important") return "important";
  return "normal";
}

function adminNotificationPriorityLabel(priority) {
  const value = String(priority || "normal").toLowerCase();

  if (value === "critical") return "Critical";
  if (value === "important") return "Important";
  return "Normal";
}

function formatAdminNotificationTime(value) {
  if (!value) return "";

  const raw = String(value).trim();
  const date = new Date(raw.replace(" ", "T") + "Z");

  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("sw-TZ", {
    timeZone: "Africa/Dar_es_Salaam",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function renderAdminNotifications(notifications, summary) {
  const container = document.getElementById("notificationsContent");
  const unreadCount = document.getElementById("adminNotificationUnreadCount");
  const summaryTitle = document.getElementById("adminNotificationSummaryTitle");

  if (!container) return;

  const unread = Number(summary?.unread || 0);
  const total = Number(summary?.total || 0);

  if (unreadCount) {
    unreadCount.textContent = String(unread);
  }

  if (summaryTitle) {
    summaryTitle.textContent =
      unread > 0
        ? `${unread} unread notification${unread === 1 ? "" : "s"}`
        : `${total} notification${total === 1 ? "" : "s"}`;
  }

  if (!Array.isArray(notifications) || notifications.length === 0) {
    container.innerHTML = `
      <div class="admin-notifications-empty">
        <div class="admin-notifications-empty-icon">🔔</div>
        <strong>No notifications found</strong>
        <span>Hakuna notifications kwenye filter hii.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = notifications.map(notification => {
    const priority = adminNotificationPriorityClass(notification.priority);
    const priorityLabel = adminNotificationPriorityLabel(notification.priority);
    const isUnread = Number(notification.is_read || 0) === 0;

    return `
      <article
        class="admin-notification-card ${isUnread ? "is-unread" : ""} priority-${priority}"
        data-notification-id="${Number(notification.id)}"
      >
        <div class="admin-notification-card-icon">
          ${priority === "critical" ? "🚨" : priority === "important" ? "⚠️" : "🔔"}
        </div>

        <div class="admin-notification-card-body">
          <div class="admin-notification-card-top">
            <div>
              <span class="admin-notification-priority priority-${priority}">
                ${escapeAdminNotificationHTML(priorityLabel)}
              </span>
              <strong>
                ${escapeAdminNotificationHTML(notification.title)}
              </strong>
            </div>

            ${
              isUnread
                ? `
                  <button
                    type="button"
                    class="admin-notification-read-btn"
                    data-notification-read="${Number(notification.id)}"
                  >
                    Mark read
                  </button>
                `
                : `
                  <span class="admin-notification-read-label">
                    Read
                  </span>
                `
            }
          </div>

          <p>
            ${escapeAdminNotificationHTML(notification.message)}
          </p>

          <div class="admin-notification-card-meta">
            <span>${escapeAdminNotificationHTML(notification.type || "system")}</span>
            <span>${escapeAdminNotificationHTML(formatAdminNotificationTime(notification.created_at))}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

async function loadAdminNotifications(filter = adminNotificationFilter) {
  const container = document.getElementById("notificationsContent");
  if (!container) return;

  adminNotificationFilter = filter;

  const token = sessionStorage.getItem("zenodicAdminToken");

  container.innerHTML = `
    <div class="admin-notifications-empty">
      <div class="admin-notifications-empty-icon">⏳</div>
      <strong>Loading notifications...</strong>
      <span>Inapakia alerts za admin.</span>
    </div>
  `;

  try {
    const response = await fetch(
      `${API}/api/admin/management/notifications?filter=${encodeURIComponent(filter)}&limit=50`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Accept": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kupata admin notifications."
      );
    }

    renderAdminNotifications(
      data.notifications || [],
      data.summary || {}
    );
  } catch (error) {
    console.error("ADMIN NOTIFICATIONS ERROR:", error);

    container.innerHTML = `
      <div class="admin-notifications-empty">
        <div class="admin-notifications-empty-icon">!</div>
        <strong>Notifications hazikupatikana</strong>
        <span>${escapeAdminNotificationHTML(error.message)}</span>
      </div>
    `;
  }
}

async function markAdminNotificationRead(notificationId) {
  const id = Number(notificationId);
  if (!Number.isInteger(id) || id <= 0) return;

  const token = sessionStorage.getItem("zenodicAdminToken");

  try {
    const response = await fetch(
      `${API}/api/admin/management/notifications/${id}/read`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kuweka notification kama read."
      );
    }

    await loadAdminNotifications(adminNotificationFilter);
  } catch (error) {
    console.error("ADMIN NOTIFICATION READ ERROR:", error);
    alert(error.message || "Imeshindikana kuweka notification kama read.");
  }
}

async function markAllAdminNotificationsRead() {
  const token = sessionStorage.getItem("zenodicAdminToken");

  try {
    const response = await fetch(
      `${API}/api/admin/management/notifications/read-all`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Imeshindikana kuweka notifications zote kama read."
      );
    }

    await loadAdminNotifications(adminNotificationFilter);
  } catch (error) {
    console.error("ADMIN NOTIFICATIONS READ-ALL ERROR:", error);
    alert(error.message || "Imeshindikana kuweka notifications zote kama read.");
  }
}

async function requestAdminCommissionPayout() {
  const amountEl = document.getElementById("adminCommissionPayoutAmount");
  const notesEl = document.getElementById("adminCommissionPayoutNotes");
  const buttonEl = document.getElementById("requestAdminCommissionPayoutBtn");
  const messageEl = document.getElementById("adminCommissionPayoutMessage");
  const currencyEl = document.getElementById("adminPayoutCurrency");

  if (!amountEl || !notesEl || !buttonEl || !messageEl) return;

  const amount = Number(amountEl.value);
  const notes = notesEl.value.trim();
  const currency = String(currencyEl?.value || "TZS").toUpperCase();

  messageEl.textContent = "";
  messageEl.classList.remove("error");

  if (!Number.isFinite(amount) || amount <= 0) {
    messageEl.textContent = "Amount lazima iwe zaidi ya 0.";
    messageEl.classList.add("error");
    return;
  }

  if (notes.length > 500) {
    messageEl.textContent = "Notes ni ndefu sana.";
    messageEl.classList.add("error");
    return;
  }

  buttonEl.disabled = true;
  buttonEl.textContent = "Requesting...";
  messageEl.textContent = "Inaunda commission payout request...";

  try {
    const response = await fetch(
      "/api/admin/management/commission-payouts",
      {
        method: "POST",
        headers: {
          ...getAdminHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount,
          currency,
          notes
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kuunda commission payout."
      );
    }

    amountEl.value = "";
    notesEl.value = "";

    messageEl.textContent =
      result.message || "Commission payout request imeundwa.";

    await loadAdminCommissionBalance();
  } catch (error) {
    console.error("Admin commission payout request UI error:", error);
    messageEl.textContent =
      error.message || "Imeshindikana kuunda commission payout.";
    messageEl.classList.add("error");
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = "Request Commission Payout";
  }
}

async function updateAdminCommissionPayoutStatus(payoutId, nextStatus, providerReference = "") {
  const messageEl = document.getElementById("adminCommissionPayoutsMessage");

  try {
    if (messageEl) {
      messageEl.textContent = "Inasasisha payout status...";
      messageEl.classList.remove("error");
    }

    const response = await fetch(
      "/api/admin/management/commission-payouts/" + encodeURIComponent(payoutId),
      {
        method: "PATCH",
        headers: {
          ...getAdminHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: nextStatus,
          provider_reference: providerReference
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kubadilisha payout status."
      );
    }

    await loadAdminCommissionPayouts();
    await loadAdminCommissionBalance();
  } catch (error) {
    console.error("Admin commission payout status UI error:", error);

    if (messageEl) {
      messageEl.textContent =
        error.message || "Imeshindikana kubadilisha payout status.";
      messageEl.classList.add("error");
    }
  }
}

async function loadAdminCommissionPayouts() {
  const contentEl = document.getElementById("adminCommissionPayoutsContent");
  const messageEl = document.getElementById("adminCommissionPayoutsMessage");

  if (!contentEl || !messageEl) return;

  messageEl.textContent = "Inapakia commission payouts...";
  messageEl.classList.remove("error");

  try {
    const response = await fetch(
      "/api/admin/management/commission-payouts",
      {
        method: "GET",
        headers: getAdminHeaders()
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kupata commission payouts."
      );
    }

    const payouts = Array.isArray(result.payouts) ? result.payouts : [];

    if (!payouts.length) {
      contentEl.innerHTML =
        '<div class="empty-state">Hakuna commission payout requests bado.</div>';
      messageEl.textContent = "";
      return;
    }

    const rows = payouts.map(function(payout) {
      const account =
        payout.account_name ||
        payout.provider ||
        "Admin Payment Account";

      const destination =
        payout.account_number
          ? account + " • " + payout.account_number
          : account;

      return `
        <tr>
          <td>
            <strong>${escapeHTML(payout.payout_reference || "—")}</strong>
            <div class="admin-commission-payout-meta">
              ${escapeHTML(payout.created_at || "—")}
            </div>
          </td>
          <td>
            <strong>${Number(payout.amount || 0).toLocaleString("en-TZ")} ${escapeHTML(payout.currency || "TZS")}</strong>
          </td>
          <td>
            <span class="admin-payout-status status-${escapeHTML(payout.status || "pending")}">
              ${escapeHTML(payout.status || "pending")}
            </span>
          </td>
          <td>${escapeHTML(destination)}</td>
          <td>${escapeHTML(payout.provider_reference || "—")}</td>
          <td>${escapeHTML(payout.notes || "—")}</td>
          <td>
            ${
              String(payout.status || "").toLowerCase() === "pending"
                ? `<button
                    type="button"
                    class="settings-action-btn admin-commission-payout-status-btn"
                    data-payout-id="${escapeHTML(payout.id)}"
                    data-next-status="processing"
                  >Processing</button>`
                : String(payout.status || "").toLowerCase() === "processing"
                  ? `<div class="admin-commission-payout-paid-action">
                      <input
                        type="text"
                        class="admin-commission-payout-provider-ref"
                        data-payout-id="${escapeHTML(payout.id)}"
                        placeholder="Provider Reference"
                        maxlength="160"
                      >
                      <div class="admin-commission-payout-status-actions">
                        <button
                          type="button"
                          class="settings-action-btn admin-commission-payout-status-btn"
                          data-payout-id="${escapeHTML(payout.id)}"
                          data-next-status="paid"
                        >Paid</button>
                        <button
                          type="button"
                          class="settings-action-btn admin-commission-payout-status-btn"
                          data-payout-id="${escapeHTML(payout.id)}"
                          data-next-status="failed"
                        >Failed</button>
                        <button
                          type="button"
                          class="settings-action-btn admin-commission-payout-status-btn"
                          data-payout-id="${escapeHTML(payout.id)}"
                          data-next-status="cancelled"
                        >Cancelled</button>
                      </div>
                    </div>`
                  : "—"
            }
          </td>
        </tr>
      `;
    }).join("");

    contentEl.innerHTML = `
      <div class="table-wrap">
        <table class="admin-commission-payouts-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Destination</th>
              <th>Provider Ref</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;

    contentEl.querySelectorAll(".admin-commission-payout-status-btn").forEach(function(button) {
      button.addEventListener("click", async function() {
        const payoutId = button.dataset.payoutId;
        const nextStatus = button.dataset.nextStatus;

        if (!payoutId || !nextStatus) return;

        button.disabled = true;
        button.textContent = "Updating...";

        let providerReference = "";

        if (nextStatus === "paid") {
          const refInput = contentEl.querySelector(
            '.admin-commission-payout-provider-ref[data-payout-id="' +
              payoutId +
              '"]'
          );

          providerReference = refInput
            ? String(refInput.value || "").trim()
            : "";

          if (!providerReference) {
            button.disabled = false;
            button.textContent = "Paid";

            if (messageEl) {
              messageEl.textContent =
                "Provider Reference inahitajika kabla ya kuweka Paid.";
              messageEl.classList.add("error");
            }

            return;
          }
        }

        await updateAdminCommissionPayoutStatus(
          payoutId,
          nextStatus,
          providerReference
        );
      });
    });

    messageEl.textContent =
      payouts.length + " commission payout request(s).";
  } catch (error) {
    console.error("Admin commission payouts UI error:", error);
    contentEl.innerHTML = "";
    messageEl.textContent =
      error.message || "Imeshindikana kupata commission payouts.";
    messageEl.classList.add("error");
  }
}

function initAdminCommissionPayout() {
  const buttonEl = document.getElementById("requestAdminCommissionPayoutBtn");

  if (!buttonEl || buttonEl.dataset.ready === "true") return;

  buttonEl.addEventListener("click", requestAdminCommissionPayout);
  buttonEl.dataset.ready = "true";
}

function initAdminPayoutAccountModal() {
  const card = document.getElementById("adminPaymentAccountCard");
  const modal = document.getElementById("adminPaymentAccountModal");
  const closeBtn = document.getElementById("closeAdminPayoutAccountBtn");

  if (!card || !modal || !closeBtn || card.dataset.modalReady === "true") return;

  function openModal() {
    modal.hidden = false;
    card.setAttribute("aria-expanded", "true");
    document.body.classList.add("admin-payment-account-modal-open");
  }

  function closeModal() {
    modal.hidden = true;
    card.setAttribute("aria-expanded", "false");
    document.body.classList.remove("admin-payment-account-modal-open");
  }

  card.addEventListener("click", openModal);

  card.addEventListener("keydown", function(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openModal();
    }
  });

  closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", function(event) {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function(event) {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  card.dataset.modalReady = "true";
}




async function saveAdminGeneralSettings() {
  const siteNameEl = document.getElementById("adminSiteName");
  const descriptionEl = document.getElementById("adminSiteDescription");
  const supportEmailEl = document.getElementById("adminSupportEmail");
  const currencyEl = document.getElementById("adminDefaultCurrency");
  const maintenanceEl = document.getElementById("adminMaintenanceMode");
  const saveBtn = document.getElementById("saveAdminGeneralSettingsBtn");
  const messageEl = document.getElementById("adminGeneralSettingsMessage");

  if (
    !siteNameEl ||
    !descriptionEl ||
    !supportEmailEl ||
    !currencyEl ||
    !maintenanceEl ||
    !saveBtn
  ) {
    return;
  }

  const payload = {
    site_name: String(siteNameEl.value || "").trim(),
    site_description: String(descriptionEl.value || "").trim(),
    support_email: String(supportEmailEl.value || "").trim(),
    default_currency: String(currencyEl.value || "TZS").trim().toUpperCase(),
    maintenance_mode:
      String(maintenanceEl.value || "false").toLowerCase() === "true"
  };

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  if (messageEl) {
    messageEl.textContent = "Inahifadhi General Settings...";
    messageEl.classList.remove("error");
  }

  try {
    const response = await fetch(
      "/api/admin/management/settings",
      {
        method: "PATCH",
        headers: {
          ...getAdminHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kuhifadhi General Settings."
      );
    }

    if (messageEl) {
      messageEl.textContent = "General Settings zimehifadhiwa.";
    }
  } catch (error) {
    console.error("Admin General Settings save error:", error);

    if (messageEl) {
      messageEl.textContent =
        error.message || "Imeshindikana kuhifadhi General Settings.";
      messageEl.classList.add("error");
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 Save General Settings";
  }
}


function initAdminGeneralSettings() {
  const card = document.getElementById("adminGeneralSettingsCard");
  const openBtn = document.getElementById("openAdminGeneralSettingsBtn");
  const modal = document.getElementById("adminGeneralSettingsModal");
  const closeBtn = document.getElementById("closeAdminGeneralSettingsBtn");

  if (!modal) return;

  function openModal() {
    modal.hidden = false;
    if (card) card.setAttribute("aria-expanded", "true");
    loadAdminGeneralSettings();
  }

  function closeModal() {
    modal.hidden = true;
    if (card) card.setAttribute("aria-expanded", "false");
  }

  if (openBtn) {
    openBtn.addEventListener("click", function(event) {
      event.stopPropagation();
      openModal();
    });
  }

  if (card) {
    card.addEventListener("keydown", function(event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", function(event) {
    if (event.target === modal) {
      closeModal();
    }
  });
}

async function loadAdminGeneralSettings() {
  const siteNameEl = document.getElementById("adminSiteName");
  const descriptionEl = document.getElementById("adminSiteDescription");
  const supportEmailEl = document.getElementById("adminSupportEmail");
  const currencyEl = document.getElementById("adminDefaultCurrency");
  const maintenanceEl = document.getElementById("adminMaintenanceMode");
  const messageEl = document.getElementById("adminGeneralSettingsMessage");

  if (
    !siteNameEl ||
    !descriptionEl ||
    !supportEmailEl ||
    !currencyEl ||
    !maintenanceEl
  ) {
    return;
  }

  if (messageEl) {
    messageEl.textContent = "Inapakia General Settings...";
    messageEl.classList.remove("error");
  }

  try {
    const response = await fetch(
      "/api/admin/management/settings",
      {
        method: "GET",
        headers: getAdminHeaders()
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kupakia General Settings."
      );
    }

    const settings = result.settings || {};

    if (settings.commission_rate !== undefined) {
      const backendCommissionRate = Number(settings.commission_rate);

      if (
        Number.isFinite(backendCommissionRate) &&
        backendCommissionRate >= 0 &&
        backendCommissionRate <= 100
      ) {
        localStorage.setItem(
          "zenodic_commission_rate",
          String(backendCommissionRate)
        );
      }
    }

    siteNameEl.value = settings.site_name || "";
    descriptionEl.value = settings.site_description || "";
    supportEmailEl.value = settings.support_email || "";
    currencyEl.value = settings.default_currency || "TZS";
    maintenanceEl.value =
      String(settings.maintenance_mode || "false").toLowerCase() === "true"
        ? "true"
        : "false";

    if (messageEl) {
      messageEl.textContent = "Settings zimepakiwa.";
    }
  } catch (error) {
    console.error("Admin General Settings load error:", error);

    if (messageEl) {
      messageEl.textContent =
        error.message || "Imeshindikana kupakia General Settings.";
      messageEl.classList.add("error");
    }
  }
}

async function loadAdminCommissionBalance() {
  const totalEl = document.getElementById("adminTotalCommission");
  const reservedEl = document.getElementById("adminReservedCommission");
  const availableEl = document.getElementById("adminAvailableCommission");
  const messageEl = document.getElementById("adminCommissionBalanceMessage");

  if (!totalEl || !reservedEl || !availableEl || !messageEl) return;

  messageEl.textContent = "Inapakia commission balance...";
  messageEl.classList.remove("error");

  try {
    const response = await fetch(
      "/api/admin/management/commission-payout-summary?currency=TZS",
      {
        method: "GET",
        headers: getAdminHeaders()
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kupakia commission balance."
      );
    }

    const currency = result.currency || "TZS";
    const total = Number(result.total_commission || 0);
    const reserved = Number(result.reserved_payout || 0);
    const available = Number(result.available_commission || 0);

    totalEl.textContent = total.toLocaleString("en-TZ") + " " + currency;
    reservedEl.textContent = reserved.toLocaleString("en-TZ") + " " + currency;
    availableEl.textContent = available.toLocaleString("en-TZ") + " " + currency;

    if (result.payout_account) {
      messageEl.textContent =
        "Account active: " +
        (result.payout_account.provider || "Payment Account");
    } else {
      messageEl.textContent = "Hakuna Admin Payment Account active.";
    }
  } catch (error) {
    console.error("Admin commission balance UI error:", error);
    totalEl.textContent = "—";
    reservedEl.textContent = "—";
    availableEl.textContent = "—";
    messageEl.textContent =
      error.message || "Imeshindikana kupakia commission balance.";
    messageEl.classList.add("error");
  }
}

async function initAdminPayoutAccount() {
  const typeEl = document.getElementById("adminPayoutAccountType");
  const providerEl = document.getElementById("adminPayoutProvider");
  const nameEl = document.getElementById("adminPayoutAccountName");
  const numberEl = document.getElementById("adminPayoutAccountNumber");
  const currencyEl = document.getElementById("adminPayoutCurrency");
  const saveBtn = document.getElementById("saveAdminPayoutAccountBtn");
  const messageEl = document.getElementById("adminPayoutAccountMessage");

  if (
    !typeEl ||
    !providerEl ||
    !nameEl ||
    !numberEl ||
    !currencyEl ||
    !saveBtn ||
    !messageEl
  ) {
    return;
  }

  function setMessage(message, isError) {
    messageEl.textContent = message || "";
    messageEl.classList.toggle("error", Boolean(isError));
  }

  try {
    const response = await fetch(
      "/api/admin/management/payout-account",
      {
        method: "GET",
        headers: getAdminHeaders()
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kupakia payment account."
      );
    }

    const account = result.account;

    if (account) {
      typeEl.value = account.account_type || "mobile_money";
      providerEl.value = account.provider || "";
      nameEl.value = account.account_name || "";
      numberEl.value = account.account_number || "";
      currencyEl.value = account.currency || "TZS";
    }

    setMessage(account ? "Payment account imepakiwa." : "Hakuna payment account iliyowekwa bado.");
  } catch (error) {
    console.error("Admin payout account load UI error:", error);
    setMessage(
      error.message || "Imeshindikana kupakia payment account.",
      true
    );
  }

  saveBtn.addEventListener("click", async function() {
    const payload = {
      account_type: typeEl.value,
      provider: providerEl.value.trim(),
      account_name: nameEl.value.trim(),
      account_number: numberEl.value.trim(),
      currency: currencyEl.value
    };

    if (
      !payload.provider ||
      !payload.account_name ||
      !payload.account_number
    ) {
      setMessage(
        "Jaza provider, account name na account number.",
        true
      );
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/management/payout-account",
        {
          method: "PUT",
          headers: {
            ...getAdminHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Imeshindikana kuhifadhi payment account."
        );
      }

      const account = result.account || {};

      typeEl.value = account.account_type || payload.account_type;
      providerEl.value = account.provider || payload.provider;
      nameEl.value = account.account_name || payload.account_name;
      numberEl.value = account.account_number || payload.account_number;
      currencyEl.value = account.currency || payload.currency;

      setMessage(
        result.message || "Payment account imehifadhiwa."
      );
    } catch (error) {
      console.error("Admin payout account save UI error:", error);
      setMessage(
        error.message || "Imeshindikana kuhifadhi payment account.",
        true
      );
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Payment Account";
    }
  });
}

function initAdminNotifications() {
  const section = document.getElementById("notifications");
  if (!section || section.dataset.notificationsBound) return;

  section.dataset.notificationsBound = "1";

  document.querySelectorAll("[data-notification-filter]").forEach(button => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-notification-filter]")
        .forEach(item => item.classList.remove("is-active"));

      button.classList.add("is-active");

      loadAdminNotifications(
        button.dataset.notificationFilter || "all"
      );
    });
  });

  const refreshButton = document.getElementById(
    "refreshAdminNotifications"
  );

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      loadAdminNotifications(adminNotificationFilter);
    });
  }

  const markAllButton = document.getElementById(
    "markAllAdminNotificationsRead"
  );

  if (markAllButton) {
    markAllButton.addEventListener(
      "click",
      markAllAdminNotificationsRead
    );
  }

  const container = document.getElementById("notificationsContent");

  if (container) {
    container.addEventListener("click", event => {
      const button = event.target.closest(
        "[data-notification-read]"
      );

      if (!button) return;

      markAdminNotificationRead(
        button.dataset.notificationRead
      );
    });
  }

  loadAdminNotifications("all");
}

loadAdmin().then(function(success) {
  if (success) {
    loadOverviewStats();
    initAdminNotifications();
    initAdminGeneralSettings();
    initAdminPayoutAccountModal();
    initAdminPayoutAccount();
    initAdminCommissionPayout();
    initAdminAuditActivity();
    loadAdminCommissionBalance();
    loadAdminCommissionPayouts();

    const refreshCommissionBalanceBtn = document.getElementById(
      "refreshAdminCommissionBalanceBtn"
    );

    if (refreshCommissionBalanceBtn) {
      refreshCommissionBalanceBtn.addEventListener(
        "click",
        loadAdminCommissionBalance
      );
    }

    const refreshAdminCommissionPayoutsBtn = document.getElementById(
      "refreshAdminCommissionPayoutsBtn"
    );

    if (refreshAdminCommissionPayoutsBtn) {
      refreshAdminCommissionPayoutsBtn.addEventListener(
        "click",
        loadAdminCommissionPayouts
      );
    }

    initAdminPasskeySettings();
  }


const saveAdminGeneralSettingsBtn = document.getElementById(
  "saveAdminGeneralSettingsBtn"
);

if (saveAdminGeneralSettingsBtn) {
  saveAdminGeneralSettingsBtn.addEventListener(
    "click",
    saveAdminGeneralSettings
  );
}

});

function initAdminPasskeySettings() {
  const openButton = document.getElementById("openPasskeySettingsBtn");
  const closeButton = document.getElementById("closePasskeySettingsBtn");
  const registerButton = document.getElementById("registerAdminPasskeyBtn");
  const panel = document.getElementById("passkeySettingsPanel");

  if (!panel) return;

  if (openButton) {
    openButton.addEventListener("click", async function() {
      panel.hidden = false;
      await loadAdminPasskeys();
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", function() {
      panel.hidden = true;
    });
  }

  if (registerButton) {
    registerButton.addEventListener("click", registerAdminPasskey);
  }
}

function base64UrlToArrayBuffer(value) {
  const base64 = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function setAdminPasskeyMessage(message, isError = false) {
  const element = document.getElementById("adminPasskeyMessage");

  if (!element) return;

  element.textContent = message || "";
  element.classList.toggle("error", Boolean(isError));
}

async function loadAdminPasskeys() {
  const list = document.getElementById("adminPasskeyList");

  if (!list) return;

  list.innerHTML = `
    <div class="passkey-empty-state">
      Inapakia passkeys...
    </div>
  `;

  try {
    const response = await fetch("/api/admin/management/passkeys", {
      method: "GET",
      headers: getAdminHeaders()
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kupakia passkeys."
      );
    }

    const passkeys = Array.isArray(result.passkeys)
      ? result.passkeys
      : [];

    if (!passkeys.length) {
      list.innerHTML = `
        <div class="passkey-empty-state">
          Hakuna passkey iliyosajiliwa bado.
        </div>
      `;
      return;
    }

    list.innerHTML = passkeys.map((passkey) => {
      const transports = Array.isArray(passkey.transports)
        ? passkey.transports.join(", ")
        : "";

      return `
        <div class="passkey-item">
          <div class="passkey-item-main">
            <strong>🔑 Passkey #${escapeHTML(String(passkey.id))}</strong>
            <span>
              Imetengenezwa:
              ${escapeHTML(formatAdminNotificationTime(passkey.created_at))}
            </span>
            <span>
              Last used:
              ${escapeHTML(
                formatAdminNotificationTime(passkey.last_used_at) || "Bado"
              )}
            </span>
            ${
              transports
                ? `<span>Transport: ${escapeHTML(transports)}</span>`
                : ""
            }
          </div>

          <button
            type="button"
            class="settings-action-btn passkey-revoke-btn"
            data-passkey-id="${escapeHTML(String(passkey.id))}"
          >
            Revoke
          </button>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".passkey-revoke-btn").forEach((button) => {
      button.addEventListener("click", function() {
        revokeAdminPasskey(button.dataset.passkeyId);
      });
    });
  } catch (error) {
    console.error("Admin passkey list error:", error);

    list.innerHTML = `
      <div class="passkey-empty-state">
        Imeshindikana kupakia passkeys.
      </div>
    `;

    setAdminPasskeyMessage(
      error.message || "Imeshindikana kupakia passkeys.",
      true
    );
  }
}

async function registerAdminPasskey() {
  const button = document.getElementById("registerAdminPasskeyBtn");

  if (!button) return;

  if (!window.PublicKeyCredential || !navigator.credentials) {
    setAdminPasskeyMessage(
      "Browser hii hai-support passkeys/WebAuthn.",
      true
    );
    return;
  }

  button.disabled = true;
  button.textContent = "🔐 Inasajili...";

  setAdminPasskeyMessage(
    "Fuata maelekezo ya simu au laptop. Unaweza kutumia fingerprint, Face ID, Windows Hello au screen lock."
  );

  try {
    const optionsResponse = await fetch(
      "/api/admin/webauthn/register/options",
      {
        method: "POST",
        headers: {
          ...getAdminHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      }
    );

    const optionsResult = await optionsResponse.json().catch(() => ({}));

    if (!optionsResponse.ok || !optionsResult.success) {
      throw new Error(
        optionsResult.message ||
        "Imeshindikana kuanzisha usajili wa passkey."
      );
    }

    const publicKey = optionsResult.options || optionsResult;

    publicKey.challenge = base64UrlToArrayBuffer(publicKey.challenge);

    if (publicKey.user && publicKey.user.id) {
      publicKey.user.id = base64UrlToArrayBuffer(publicKey.user.id);
    }

    if (Array.isArray(publicKey.excludeCredentials)) {
      publicKey.excludeCredentials = publicKey.excludeCredentials.map(
        (credential) => ({
          ...credential,
          id: credential.id
        })
      );
    }

    const credential = await navigator.credentials.create({
      publicKey
    });

    if (!credential) {
      throw new Error("Usajili wa passkey umeghairiwa.");
    }

    const response = credential.response;

    const verifyResponse = await fetch(
      "/api/admin/webauthn/register/verify",
      {
        method: "POST",
        headers: {
          ...getAdminHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: credential.id,
          rawId: arrayBufferToBase64Url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: arrayBufferToBase64Url(
              response.clientDataJSON
            ),
            attestationObject: arrayBufferToBase64Url(
              response.attestationObject
            ),
            transports:
              typeof response.getTransports === "function"
                ? response.getTransports()
                : []
          }
        })
      }
    );

    const verifyResult = await verifyResponse.json().catch(() => ({}));

    if (!verifyResponse.ok || !verifyResult.success) {
      throw new Error(
        verifyResult.message ||
        "Passkey haikuweza kuhifadhiwa."
      );
    }

    setAdminPasskeyMessage(
      "✅ Passkey imesajiliwa kikamilifu."
    );

    await loadAdminPasskeys();
  } catch (error) {
    console.error("Admin passkey registration error:", error);

    setAdminPasskeyMessage(
      error.message || "Usajili wa passkey umeshindikana.",
      true
    );
  } finally {
    button.disabled = false;
    button.textContent = "🔑 Register New Passkey";
  }
}

async function revokeAdminPasskey(passkeyId) {
  if (!passkeyId) return;

  const confirmed = window.confirm(
    "Una uhakika unataka kuondoa passkey hii?"
  );

  if (!confirmed) return;

  setAdminPasskeyMessage("Inaondoa passkey...");

  try {
    const response = await fetch(
      "/api/admin/management/passkeys/" +
        encodeURIComponent(passkeyId),
      {
        method: "DELETE",
        headers: getAdminHeaders()
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kuondoa passkey."
      );
    }

    setAdminPasskeyMessage("✅ Passkey imeondolewa.");

    await loadAdminPasskeys();
  } catch (error) {
    console.error("Admin passkey revoke error:", error);

    setAdminPasskeyMessage(
      error.message || "Imeshindikana kuondoa passkey.",
      true
    );
  }
}


/* ===== Admin Audit & Activity ===== */
let adminAuditCurrentPage = 1;
let adminAuditTotalPages = 1;

async function loadAdminAuditLogs(page = 1) {
  const body = document.getElementById("adminAuditActivityBody");
  const messageEl = document.getElementById("adminAuditActivityMessage");
  const infoEl = document.getElementById("adminAuditPaginationInfo");
  const prevBtn = document.getElementById("adminAuditPrevBtn");
  const nextBtn = document.getElementById("adminAuditNextBtn");

  if (!body || !messageEl) return;

  const search =
    document.getElementById("adminAuditSearch")?.value.trim() || "";
  const action =
    document.getElementById("adminAuditAction")?.value.trim() || "";
  const days =
    document.getElementById("adminAuditDays")?.value || "30";

  messageEl.textContent = "Inapakia audit activity...";
  messageEl.classList.remove("error");
  body.innerHTML = "";

  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
      days: String(days)
    });

    if (search) params.set("search", search);
    if (action) params.set("action", action);

    const response = await fetch(
      "/api/admin/management/audit-logs?" + params.toString(),
      {
        method: "GET",
        headers: getAdminHeaders()
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kupakia audit logs."
      );
    }

    const logs = Array.isArray(result.logs) ? result.logs : [];
    const pagination = result.pagination || {};

    adminAuditCurrentPage = Number(pagination.page || page);
    adminAuditTotalPages = Math.max(
      1,
      Number(pagination.total_pages || 1)
    );

    if (!logs.length) {
      body.innerHTML = `
        <tr>
          <td colspan="6">Hakuna activity iliyopatikana.</td>
        </tr>
      `;
    } else {
      body.innerHTML = logs.map((log) => {
        const adminName =
          log.admin_name ||
          log.admin_email ||
          "System";

        const target = [
          log.target_type,
          log.target_id
        ].filter(Boolean).join(" # ") || "—";

        return `
          <tr>
            <td>${escapeHTML(formatAdminNotificationTime(log.created_at))}</td>
            <td>${escapeHTML(adminName)}</td>
            <td><strong>${escapeHTML(log.action || "unknown")}</strong></td>
            <td>${escapeHTML(target)}</td>
            <td>${escapeHTML(log.description || "—")}</td>
            <td><button type="button" class="settings-action-btn admin-audit-delete-btn" data-audit-id="${log.id}">🗑️ Delete</button></td>
          </tr>
        `;
      }).join("");
    }

    if (infoEl) {
      infoEl.textContent =
        "Page " +
        adminAuditCurrentPage +
        " / " +
        adminAuditTotalPages +
        " • " +
        Number(pagination.total || 0) +
        " events";
    }

    if (prevBtn) {
      prevBtn.disabled = adminAuditCurrentPage <= 1;
    }

    if (nextBtn) {
      nextBtn.disabled =
        adminAuditCurrentPage >= adminAuditTotalPages;
    }

    messageEl.textContent = logs.length
      ? "Audit activity imepakiwa."
      : "Hakuna activity kwa filters hizi.";
  } catch (error) {
    console.error("Admin audit activity UI error:", error);

    messageEl.textContent =
      error.message || "Imeshindikana kupakia audit logs.";
    messageEl.classList.add("error");

    if (infoEl) {
      infoEl.textContent = "Page 1";
    }
  }
}

function initAdminAuditActivity() {
  const openBtn = document.getElementById(
    "openAdminAuditActivityBtn"
  );
  const closeBtn = document.getElementById(
    "closeAdminAuditActivityBtn"
  );
  const modal = document.getElementById(
    "adminAuditActivityModal"
  );
  const refreshBtn = document.getElementById(
    "refreshAdminAuditActivityBtn"
  );
  const prevBtn = document.getElementById(
    "adminAuditPrevBtn"
  );
  const nextBtn = document.getElementById(
    "adminAuditNextBtn"
  );

  if (!openBtn || !modal) return;

  function openModal() {
    modal.hidden = false;
    document.body.classList.add("modal-open");
    loadAdminAuditLogs(1);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  openBtn.addEventListener("click", openModal);

  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  modal
    .querySelector("[data-close-admin-audit-modal]")
    ?.addEventListener("click", closeModal);

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadAdminAuditLogs(adminAuditCurrentPage);
    });
  }

  document
    .getElementById("adminAuditSearch")
    ?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        loadAdminAuditLogs(1);
      }
    });

  document
    .getElementById("adminAuditAction")
    ?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        loadAdminAuditLogs(1);
      }
    });

  document
    .getElementById("adminAuditDays")
    ?.addEventListener("change", () => {
      loadAdminAuditLogs(1);
    });

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (adminAuditCurrentPage > 1) {
        loadAdminAuditLogs(adminAuditCurrentPage - 1);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (adminAuditCurrentPage < adminAuditTotalPages) {
        loadAdminAuditLogs(adminAuditCurrentPage + 1);
      }
    });
  }

  const auditBody = document.getElementById("adminAuditActivityBody");

  if (auditBody) {
    auditBody.addEventListener("click", async (event) => {
      const button = event.target.closest(".admin-audit-delete-btn");
      if (!button) return;

      const id = Number(button.dataset.auditId);
      if (!Number.isInteger(id) || id <= 0) return;

      const confirmed = window.confirm(
        "Una uhakika unataka kufuta audit activity hii?"
      );

      if (!confirmed) return;

      button.disabled = true;

      try {
        const response = await fetch(
          "/api/admin/management/audit-logs/" + id,
          {
            method: "DELETE",
            headers: getAdminHeaders()
          }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Imeshindikana kufuta audit activity."
          );
        }

        const messageEl = document.getElementById(
          "adminAuditActivityMessage"
        );

        if (messageEl) {
          messageEl.textContent = "✅ Audit activity imefutwa.";
          messageEl.classList.remove("error");
        }

        await loadAdminAuditLogs(adminAuditCurrentPage);
      } catch (error) {
        console.error("Admin audit delete UI error:", error);

        const messageEl = document.getElementById(
          "adminAuditActivityMessage"
        );

        if (messageEl) {
          messageEl.textContent =
            error.message || "Imeshindikana kufuta audit activity.";
          messageEl.classList.add("error");
        }
      } finally {
        button.disabled = false;
      }
    });
  }
}


/* Settings Commission */
async function saveAdminCommissionSetting() {
  const input = document.getElementById("adminCommissionRate");
  const button = document.getElementById("saveCommissionBtn");
  const message = document.getElementById("commissionMessage");

  if (!input || !button) return;

  const value = Number(input.value);

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    if (message) {
      message.textContent = "Commission lazima iwe kati ya 0% na 100%.";
      message.classList.add("error");
    }
    return;
  }

  button.disabled = true;
  button.textContent = "Saving...";

  if (message) {
    message.textContent = "Inahifadhi...";
    message.classList.remove("error");
  }

  try {
    const response = await fetch("/api/admin/management/settings", {
      method: "PATCH",
      headers: {
        ...getAdminHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        commission_rate: value
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kuhifadhi commission rate."
      );
    }

    localStorage.setItem(
      "zenodic_commission_rate",
      String(value)
    );

    if (message) {
      message.textContent =
        "✅ Commission rate imehifadhiwa: " + value + "%";
      message.classList.remove("error");
    }
  } catch (error) {
    console.error("Admin commission setting error:", error);

    if (message) {
      message.textContent =
        error.message || "Imeshindikana kuhifadhi commission rate.";
      message.classList.add("error");
    }
  } finally {
    button.disabled = false;
    button.textContent = "💾 Save Commission";
  }
}

function initAdminCommissionSetting() {
  const button = document.getElementById("saveCommissionBtn");

  if (!button) return;

  button.addEventListener("click", saveAdminCommissionSetting);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdminCommissionSetting);
} else {
  initAdminCommissionSetting();
}

async function loadAdminSecurityEmail() {
  const input = document.getElementById("adminSecurityEmail");
  if (!input) return;

  try {
    const response = await fetch("/api/admin/management/security/email", {
      credentials: "include"
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Imeshindikana kupakia admin email.");
    }

    input.value = result.email || "";
  } catch (error) {
    console.error("Admin security email load error:", error);
  }
}

async function saveAdminSecurityEmail() {
  const input = document.getElementById("adminSecurityEmail");
  const button = document.getElementById("saveAdminSecurityEmailBtn");
  const message = document.getElementById("adminSecurityEmailMessage");

  if (!input || !button) return;

  const email = input.value.trim().toLowerCase();

  if (!email) {
    if (message) {
      message.textContent = "Weka admin email.";
      message.classList.add("error");
    }
    return;
  }

  button.disabled = true;

  if (message) {
    message.textContent = "Inahifadhi...";
    message.classList.remove("error");
  }

  try {
    const response = await fetch("/api/admin/management/security/email", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ email })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Imeshindikana kuhifadhi admin email.");
    }

    input.value = result.email || email;

    if (message) {
      message.textContent = "✅ Admin email imehifadhiwa.";
      message.classList.remove("error");
    }
  } catch (error) {
    console.error("Admin security email save error:", error);

    if (message) {
      message.textContent =
        error.message || "Imeshindikana kuhifadhi admin email.";
      message.classList.add("error");
    }
  } finally {
    button.disabled = false;
  }
}

async function changeAdminSecurityPassword() {
  const currentInput = document.getElementById("adminCurrentPassword");
  const newInput = document.getElementById("adminNewPassword");
  const confirmInput = document.getElementById("adminConfirmPassword");
  const button = document.getElementById("changeAdminPasswordBtn");
  const message = document.getElementById("adminSecurityPasswordMessage");

  if (!currentInput || !newInput || !confirmInput || !button) return;

  const currentPassword = currentInput.value;
  const newPassword = newInput.value;
  const confirmPassword = confirmInput.value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    if (message) {
      message.textContent = "Jaza password zote zinazohitajika.";
      message.classList.add("error");
    }
    return;
  }

  if (newPassword.length < 8) {
    if (message) {
      message.textContent = "Password mpya iwe na angalau characters 8.";
      message.classList.add("error");
    }
    return;
  }

  if (newPassword !== confirmPassword) {
    if (message) {
      message.textContent = "Password mpya hazilingani.";
      message.classList.add("error");
    }
    return;
  }

  button.disabled = true;

  if (message) {
    message.textContent = "Inabadilisha password...";
    message.classList.remove("error");
  }

  try {
    const response = await fetch("/api/admin/management/security/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Imeshindikana kubadilisha admin password."
      );
    }

    currentInput.value = "";
    newInput.value = "";
    confirmInput.value = "";

    if (message) {
      message.textContent = "✅ Admin password imebadilishwa.";
      message.classList.remove("error");
    }
  } catch (error) {
    console.error("Admin security password change error:", error);

    if (message) {
      message.textContent =
        error.message || "Imeshindikana kubadilisha admin password.";
      message.classList.add("error");
    }
  } finally {
    button.disabled = false;
  }
}

function initAdminSecuritySettings() {
  const saveEmailButton = document.getElementById("saveAdminSecurityEmailBtn");
  const changePasswordButton = document.getElementById("changeAdminPasswordBtn");

  if (saveEmailButton) {
    saveEmailButton.addEventListener("click", saveAdminSecurityEmail);
  }

  if (changePasswordButton) {
    changePasswordButton.addEventListener(
      "click",
      changeAdminSecurityPassword
    );
  }

  loadAdminSecurityEmail();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdminSecuritySettings);
} else {
  initAdminSecuritySettings();
}
