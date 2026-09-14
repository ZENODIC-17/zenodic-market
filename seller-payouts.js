(function () {
  "use strict";

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatMoney(amount, currency) {
    const value = Number(amount || 0);

    return `${escapeHTML(currency || "TZS")} ${value.toLocaleString()}`;
  }

  function statusLabel(status) {
    const value = String(status || "").toLowerCase();

    const labels = {
      pending: "⏳ Pending",
      processing: "🔄 Processing",
      paid: "✅ Paid",
      failed: "❌ Failed",
      cancelled: "🚫 Cancelled"
    };

    return labels[value] || value || "—";
  }

  function statusClass(status) {
    return `payout-status-${String(status || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")}`;
  }

  function allowedNextStatuses(status) {
    const value = String(status || "").toLowerCase();

    if (value === "pending") {
      return ["processing", "cancelled"];
    }

    if (value === "processing") {
      return ["paid", "failed", "cancelled"];
    }

    return [];
  }

  function openPayoutWorkflow(payout) {
    const existing = document.getElementById("adminPayoutWorkflow");
    if (existing) existing.remove();

    const statuses = allowedNextStatuses(payout.status);

    const overlay = document.createElement("div");
    overlay.id = "adminPayoutWorkflow";
    overlay.style.cssText = `
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.45);
      z-index:9999;
      display:flex;
      justify-content:flex-end;
    `;

    overlay.innerHTML = `
      <div style="
        width:min(460px,100%);
        height:100%;
        background:#fff;
        padding:24px;
        overflow:auto;
        box-shadow:-10px 0 30px rgba(0,0,0,.18);
      ">
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:16px;
          margin-bottom:24px;
        ">
          <div>
            <small style="opacity:.65;">SELLER PAYOUT</small>
            <h2 style="margin:5px 0 4px;">
              ${escapeHTML(payout.payout_reference || "Payout")}
            </h2>
            <div style="opacity:.7;">
              ${escapeHTML(
                payout.seller_name ||
                payout.seller_email ||
                `Seller #${payout.seller_id}`
              )}
            </div>
          </div>

          <button
            type="button"
            id="closePayoutWorkflow"
            style="
              border:0;
              background:transparent;
              font-size:24px;
              cursor:pointer;
            "
            aria-label="Close"
          >×</button>
        </div>

        <div style="
          padding:18px;
          border:1px solid rgba(0,0,0,.08);
          border-radius:16px;
          margin-bottom:20px;
        ">
          <small style="opacity:.65;">AMOUNT</small>
          <div style="font-size:28px;font-weight:700;margin-top:4px;">
            ${formatMoney(payout.amount, payout.currency)}
          </div>

          <div style="margin-top:14px;">
            <small style="opacity:.65;">CURRENT STATUS</small>
            <div style="margin-top:5px;">
              <span class="${statusClass(payout.status)}">
                ${escapeHTML(statusLabel(payout.status))}
              </span>
            </div>
          </div>
        </div>

        ${
          statuses.length
            ? `
              <label
                for="payoutWorkflowStatus"
                style="display:block;font-weight:600;margin-bottom:7px;"
              >
                New status
              </label>

              <select
                id="payoutWorkflowStatus"
                style="
                  width:100%;
                  padding:12px;
                  border-radius:10px;
                  border:1px solid rgba(0,0,0,.15);
                  margin-bottom:14px;
                "
              >
                ${statuses
                  .map(
                    status =>
                      `<option value="${status}">${escapeHTML(
                        statusLabel(status)
                      )}</option>`
                  )
                  .join("")}
              </select>

              <div id="payoutProviderReferenceWrap" style="display:none;">
                <label
                  for="payoutProviderReference"
                  style="display:block;font-weight:600;margin-bottom:7px;"
                >
                  Provider reference
                </label>

                <input
                  id="payoutProviderReference"
                  type="text"
                  placeholder="Reference kutoka payment provider"
                  style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border-radius:10px;
                    border:1px solid rgba(0,0,0,.15);
                    margin-bottom:14px;
                  "
                />

                <small style="display:block;margin-bottom:14px;opacity:.7;">
                  Paid inaweza kuwekwa tu ikiwa provider reference ipo.
                </small>
              </div>

              <button
                type="button"
                id="savePayoutWorkflow"
                style="
                  width:100%;
                  padding:13px 16px;
                  border:0;
                  border-radius:12px;
                  cursor:pointer;
                  font-weight:700;
                "
              >
                Update Payout
              </button>

              ${
                String(payout.status || "").toLowerCase() === "processing"
                  ? `
                    <button
                      type="button"
                      id="previewClickPesaPayout"
                      style="
                        width:100%;
                        padding:13px 16px;
                        margin-top:10px;
                        border:1px solid rgba(0,0,0,.12);
                        border-radius:12px;
                        cursor:pointer;
                        font-weight:700;
                        background:#fff;
                      "
                    >
                      Preview ClickPesa
                    </button>

                    <button
                      type="button"
                      id="createClickPesaPayout"
                      style="
                        width:100%;
                        padding:13px 16px;
                        margin-top:10px;
                        border:0;
                        border-radius:12px;
                        cursor:pointer;
                        font-weight:700;
                      "
                    >
                      Create ClickPesa Payout
                    </button>

                    ${
                      payout.status === "processing" &&
                      payout.provider_reference
                        ? `
                          <button
                            type="button"
                            id="checkClickPesaPayoutStatus"
                            style="
                              width:100%;
                              padding:13px 16px;
                              margin-top:10px;
                              border:1px solid #d0d7de;
                              border-radius:12px;
                              cursor:pointer;
                              font-weight:700;
                              background:#fff;
                            "
                          >
                            Check ClickPesa Status
                          </button>
                        `
                        : ""
                    }
                  `
                  : ""
              }

              <div
                id="payoutWorkflowMessage"
                style="display:none;margin-top:14px;"
                aria-live="polite"
              ></div>
            `
            : `
              <div class="empty">
                <strong>Payout hii haiwezi kubadilishwa tena.</strong>
                <p>
                  Status yake ya sasa ni terminal.
                </p>
              </div>
            `
        }
      </div>
    `;

    document.body.appendChild(overlay);

    document
      .getElementById("closePayoutWorkflow")
      ?.addEventListener("click", () => overlay.remove());

    if (!statuses.length) return;

    const previewButton =
      document.getElementById("previewClickPesaPayout");
    const createButton =
      document.getElementById("createClickPesaPayout");

    const checkStatusButton =
      document.getElementById("checkClickPesaPayoutStatus");

    checkStatusButton?.addEventListener("click", async () => {
      checkStatusButton.disabled = true;
      checkStatusButton.textContent = "Checking Status...";

      try {
        const token = sessionStorage.getItem("zenodicAdminToken");

        if (!token) {
          throw new Error("Admin session haipo. Ingia tena.");
        }

        const response = await fetch(
          `/api/admin/management/payouts/${encodeURIComponent(
            payout.id
          )}/clickpesa-status`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            credentials: "include"
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "ClickPesa status check imeshindikana."
          );
        }

        const message =
          document.getElementById("payoutWorkflowMessage");

        if (message) {
          message.textContent =
            data.message || "ClickPesa status imepatikana.";
          message.style.display = "block";
        }

        if (data.confirmed === true) {
          await loadAdminPayouts();
        }
      } catch (error) {
        const message =
          document.getElementById("payoutWorkflowMessage");

        if (message) {
          message.textContent =
            error.message || "ClickPesa status check imeshindikana.";
          message.style.display = "block";
        }
      } finally {
        checkStatusButton.disabled = false;
        checkStatusButton.textContent = "Check ClickPesa Status";
      }
    });

    createButton?.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Create ClickPesa payout kwa payout hii? Kwa production hii itaanzisha payout halisi."
      );

      if (!confirmed) return;

      createButton.disabled = true;
      createButton.textContent = "Creating...";

      try {
        const token = sessionStorage.getItem("zenodicAdminToken");

        if (!token) {
          throw new Error("Admin session haipo. Ingia tena.");
        }

        const response = await fetch(
          `/api/admin/management/payouts/${encodeURIComponent(
            payout.id
          )}/clickpesa-create`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            credentials: "include"
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "ClickPesa payout creation imeshindikana."
          );
        }

        const message =
          document.getElementById("payoutWorkflowMessage");

        if (message) {
          message.textContent =
            data.message || "ClickPesa payout imeanzishwa.";
          message.style.display = "block";
        }

        await loadAdminPayouts();
      } catch (error) {
        const message =
          document.getElementById("payoutWorkflowMessage");

        if (message) {
          message.textContent =
            error.message || "ClickPesa payout creation imeshindikana.";
          message.style.display = "block";
        }
      } finally {
        createButton.disabled = false;
        createButton.textContent = "Create ClickPesa Payout";
      }
    });


    previewButton?.addEventListener("click", async () => {
      previewButton.disabled = true;
      previewButton.textContent = "Checking...";

      try {
        const token = sessionStorage.getItem("zenodicAdminToken");

        if (!token) {
          throw new Error("Admin session haipo. Ingia tena.");
        }

        const response = await fetch(
          `/api/admin/management/payouts/${encodeURIComponent(
            payout.id
          )}/clickpesa-initiate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            credentials: "include"
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "ClickPesa preview imeshindikana."
          );
        }

        const message =
          document.getElementById("payoutWorkflowMessage");

        if (message) {
          message.textContent =
            "ClickPesa preview imefanikiwa.";
          message.style.display = "block";
        }
      } catch (error) {
        const message =
          document.getElementById("payoutWorkflowMessage");

        if (message) {
          message.textContent =
            error.message || "ClickPesa preview imeshindikana.";
          message.style.display = "block";
        }
      } finally {
        previewButton.disabled = false;
        previewButton.textContent = "Preview ClickPesa";
      }
    });

    const statusSelect =
      document.getElementById("payoutWorkflowStatus");

    const providerWrap =
      document.getElementById("payoutProviderReferenceWrap");

    const providerInput =
      document.getElementById("payoutProviderReference");

    const updateProviderVisibility = () => {
      const needsProvider = statusSelect.value === "paid";

      if (providerWrap) {
        providerWrap.style.display = needsProvider ? "block" : "none";
      }

      if (!needsProvider && providerInput) {
        providerInput.value = "";
      }
    };

    statusSelect.addEventListener(
      "change",
      updateProviderVisibility
    );

    updateProviderVisibility();

    document
      .getElementById("savePayoutWorkflow")
      ?.addEventListener("click", async () => {
        const token = sessionStorage.getItem("zenodicAdminToken");
        const status = statusSelect.value;
        const providerReference =
          providerInput?.value.trim() || "";

        const message =
          document.getElementById("payoutWorkflowMessage");

        if (!token) {
          if (message) {
            message.textContent =
              "Admin session inahitajika. Tafadhali ingia tena.";
            message.style.display = "block";
          }
          return;
        }

        if (status === "paid" && !providerReference) {
          if (message) {
            message.textContent =
              "Weka provider reference kabla ya kuweka Paid.";
            message.style.display = "block";
          }
          return;
        }

        const button =
          document.getElementById("savePayoutWorkflow");

        button.disabled = true;
        button.textContent = "Updating...";

        try {
          const response = await fetch(
            `/api/admin/management/payouts/${encodeURIComponent(
              payout.id
            )}/status`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              credentials: "include",
              body: JSON.stringify({
                status,
                provider_reference: providerReference
              })
            }
          );

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(
              data.message ||
                "Imeshindikana kubadilisha payout status."
            );
          }

          if (message) {
            message.textContent =
              data.message ||
              "Payout status imebadilishwa.";
            message.style.display = "block";
          }

          await loadAdminPayouts();
          overlay.remove();
        } catch (error) {
          console.error(
            "Admin payout workflow error:",
            error
          );

          if (message) {
            message.textContent =
              error.message ||
              "Imeshindikana kubadilisha payout status.";
            message.style.display = "block";
          }
        } finally {
          button.disabled = false;
          button.textContent = "Update Payout";
        }
      });
  }

  async function loadAdminPayouts() {
    const summaryEl = document.getElementById("adminPayoutSummary");
    const contentEl = document.getElementById("payoutsContent");

    if (!summaryEl || !contentEl) return;

    const token = sessionStorage.getItem("zenodicAdminToken");

    if (!token) {
      contentEl.innerHTML = `
        <div class="empty">
          Admin session inahitajika. Tafadhali ingia tena.
        </div>
      `;
      return;
    }

    summaryEl.innerHTML = `
      <div class="stat-card">
        <span>Total Payouts</span>
        <strong>—</strong>
      </div>
      <div class="stat-card">
        <span>Pending</span>
        <strong>—</strong>
      </div>
      <div class="stat-card">
        <span>Processing</span>
        <strong>—</strong>
      </div>
      <div class="stat-card">
        <span>Paid</span>
        <strong>—</strong>
      </div>
    `;

    contentEl.innerHTML = `
      <div class="empty">
        Inapakia seller payouts...
      </div>
    `;

    try {
      const response = await fetch("/api/admin/management/payouts", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        },
        credentials: "include"
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Imeshindikana kupata seller payouts."
        );
      }

      const summary = data.summary || {};
      const payouts = Array.isArray(data.payouts) ? data.payouts : [];

      const currency =
        payouts.length && payouts[0].currency
          ? payouts[0].currency
          : "TZS";

      summaryEl.innerHTML = `
        <div class="stat-card">
          <span>Total Payouts</span>
          <strong>${Number(summary.total_payouts || 0).toLocaleString()}</strong>
          <small>${formatMoney(summary.total_amount, currency)}</small>
        </div>

        <div class="stat-card">
          <span>Pending</span>
          <strong>${formatMoney(summary.pending_amount, currency)}</strong>
        </div>

        <div class="stat-card">
          <span>Processing</span>
          <strong>${formatMoney(summary.processing_amount, currency)}</strong>
        </div>

        <div class="stat-card">
          <span>Paid Out</span>
          <strong>${formatMoney(summary.paid_amount, currency)}</strong>
        </div>
      `;

      if (!payouts.length) {
        contentEl.innerHTML = `
          <div class="empty">
            <strong>Hakuna seller payouts bado.</strong>
            <p>Payout request ikitengenezwa itaonekana hapa.</p>
          </div>
        `;
        return;
      }

      contentEl.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Payout Reference</th>
                <th>Provider Reference</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              ${payouts
                .map(function (payout) {
                  const seller =
                    payout.seller_name ||
                    payout.seller_email ||
                    `Seller #${payout.seller_id}`;

                  return `
                    <tr>
                      <td>
                        <strong>${escapeHTML(seller)}</strong>
                        <br>
                        <small>
                          ${escapeHTML(payout.seller_email || "")}
                        </small>
                      </td>

                      <td>
                        <strong>
                          ${formatMoney(
                            payout.amount,
                            payout.currency
                          )}
                        </strong>
                      </td>

                      <td>
                        ${escapeHTML(
                          payout.payout_method || "—"
                        )}
                      </td>

                      <td>
                        <span class="${statusClass(
                          payout.status
                        )}">
                          ${escapeHTML(
                            statusLabel(payout.status)
                          )}
                        </span>
                      </td>

                      <td>
                        ${escapeHTML(
                          payout.payout_reference || "—"
                        )}
                      </td>

                      <td>
                        ${escapeHTML(
                          payout.provider_reference || "—"
                        )}
                      </td>

                      <td>
                        ${escapeHTML(
                          payout.created_at || "—"
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          class="admin-payout-action"
                          data-payout-id="${escapeHTML(payout.id)}"
                          style="
                            padding:8px 12px;
                            border:0;
                            border-radius:9px;
                            cursor:pointer;
                            font-weight:600;
                          "
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `;

      contentEl
        .querySelectorAll(".admin-payout-action")
        .forEach(function (button) {
          button.addEventListener("click", function () {
            const payoutId = Number(
              button.dataset.payoutId
            );

            const payout = payouts.find(
              item => Number(item.id) === payoutId
            );

            if (payout) {
              openPayoutWorkflow(payout);
            }
          });
        });
    } catch (error) {
      console.error("Admin payouts UI error:", error);

      contentEl.innerHTML = `
        <div class="empty">
          Imeshindikana kupakia seller payouts.
          <br>
          <small>${escapeHTML(error.message)}</small>
        </div>
      `;
    }
  }

  window.loadAdminPayouts = loadAdminPayouts;

  window.addEventListener("load", function () {
    loadAdminPayouts();
  });
})();
