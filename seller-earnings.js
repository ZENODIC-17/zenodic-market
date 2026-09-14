function addSellerEarningsReport() {
  const analyticsSection =
    document.getElementById("analytics");

  if (!analyticsSection) return;

  const oldPanel =
    analyticsSection.querySelector(
      ".seller-earnings-report-panel"
    );

  if (oldPanel) oldPanel.remove();

  const panel =
    document.createElement("div");

  panel.className =
    "panel seller-earnings-report-panel";

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>💵 Seller Earnings Report</h2>
        <p>Mapato ya sellers baada ya commission ya admin</p>
      </div>
    </div>

    <div id="sellerEarningsSummary"
      style="
        display:grid;
        grid-template-columns:
          repeat(auto-fit,minmax(180px,1fr));
        gap:15px;
        margin-top:20px;
      ">
    </div>

    <div id="sellerEarningsTable"
      style="
        overflow-x:auto;
        margin-top:20px;
      ">
    </div>
  `;

  analyticsSection.appendChild(panel);

  const summary =
    panel.querySelector(
      "#sellerEarningsSummary"
    );

  const table =
    panel.querySelector(
      "#sellerEarningsTable"
    );

  const db =
    JSON.parse(
      localStorage.getItem(
        "zenodicDB"
      ) || "{}"
    );

  const orders =
    Array.isArray(db.orders)
      ? db.orders
      : [];

  const rate =
    typeof getCommissionRate === "function"
      ? getCommissionRate()
      : 0;

  const paidOrders =
    orders.filter(function(order) {
      return String(
        order.paymentStatus || ""
      ).toLowerCase() === "paid";
    });

  const sellers = {};

  paidOrders.forEach(function(order) {

    const items =
      Array.isArray(order.items)
        ? order.items
        : [];

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

      if (!sellers[sellerId]) {
        sellers[sellerId] = {
          sellerId: sellerId,
          shopName: shopName,
          sales: 0,
          products: 0
        };
      }

      sellers[sellerId].sales += price;
      sellers[sellerId].products += 1;
    });
  });

  const sellerRows =
    Object.values(sellers)
      .sort(function(a, b) {
        return b.sales - a.sales;
      });

  const totalSales =
    sellerRows.reduce(
      function(sum, seller) {
        return sum + seller.sales;
      },
      0
    );

  const totalCommission =
    totalSales * rate / 100;

  const totalEarnings =
    totalSales - totalCommission;

  const totalProducts =
    sellerRows.reduce(
      function(sum, seller) {
        return sum + seller.products;
      },
      0
    );

  summary.innerHTML = `
    <div class="stat-card">
      <span>🏪 Sellers</span>
      <strong>
        ${sellerRows.length}
      </strong>
    </div>

    <div class="stat-card">
      <span>📦 Products Sold</span>
      <strong>
        ${totalProducts}
      </strong>
    </div>

    <div class="stat-card">
      <span>💰 Gross Sales</span>
      <strong>
        TSh ${totalSales.toLocaleString()}
      </strong>
    </div>

    <div class="stat-card">
      <span>📊 Admin Commission</span>
      <strong>
        TSh ${totalCommission.toLocaleString()}
      </strong>
    </div>

    <div class="stat-card">
      <span>💵 Seller Earnings</span>
      <strong>
        TSh ${totalEarnings.toLocaleString()}
      </strong>
    </div>
  `;

  if (!sellerRows.length) {
    table.innerHTML = `
      <div class="empty">
        Hakuna paid seller sales bado.
      </div>
    `;

    return;
  }

  table.innerHTML = `
    <table
      style="
        width:100%;
        border-collapse:collapse;
      "
    >
      <thead>
        <tr>
          <th>Shop</th>
          <th>Seller ID</th>
          <th>Products</th>
          <th>Gross Sales</th>
          <th>Commission</th>
          <th>Net Earnings</th>
        </tr>
      </thead>

      <tbody>
        ${sellerRows.map(function(seller) {

          const commission =
            seller.sales *
            rate /
            100;

          const earnings =
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
                ${seller.products}
              </td>

              <td>
                TSh ${seller.sales.toLocaleString()}
              </td>

              <td>
                TSh ${commission.toLocaleString()}
              </td>

              <td>
                TSh ${earnings.toLocaleString()}
              </td>
            </tr>
          `;

        }).join("")}
      </tbody>
    </table>
  `;
}
window.addEventListener("load", function() { addSellerEarningsReport(); });
