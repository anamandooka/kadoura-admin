const cfg = window.KADOURA_CONFIG;
const supabaseClient = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const ordersList = document.getElementById("ordersList");
const statusFilter = document.getElementById("statusFilter");
const orderModal = document.getElementById("orderModal");
const orderDetails = document.getElementById("orderDetails");
const closeModal = document.getElementById("closeModal");

const labels = {
  new: "جديد",
  preparing: "قيد التحضير",
  ready: "جاهز",
  out_for_delivery: "خرج للتوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغي"
};

function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  loadOrders();
}

function showLogin() {
  appScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) showApp();
  else showLogin();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = error.message;
    return;
  }
  showApp();
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showLogin();
});

statusFilter.addEventListener("change", loadOrders);
closeModal.addEventListener("click", () => orderModal.classList.add("hidden"));
orderModal.addEventListener("click", (e) => {
  if (e.target === orderModal) orderModal.classList.add("hidden");
});

async function loadOrders() {
  ordersList.innerHTML = '<div class="empty">جاري تحميل الطلبات...</div>';
  let query = supabaseClient.from("orders").select("*").order("created_at", { ascending: false });
  const filter = statusFilter.value;
  if (filter) query = query.eq("status", filter);

  const { data, error } = await query;
  if (error) {
    ordersList.innerHTML = `<div class="error">تعذر تحميل الطلبات: ${escapeHtml(error.message)}</div>`;
    return;
  }

  updateStats(data || []);
  if (!data?.length) {
    ordersList.innerHTML = '<div class="empty">لا توجد طلبات حاليًا</div>';
    return;
  }

  ordersList.innerHTML = data.map(order => `
    <article class="order-card" data-id="${order.id}">
      <div>
        <h3>طلب #${order.order_number}</h3>
        <p>${escapeHtml(order.customer_name)} — ${escapeHtml(order.phone)}</p>
        <small>${new Date(order.created_at).toLocaleString("ar-EG")}</small>
      </div>
      <div class="order-side">
        <strong>${Number(order.total).toFixed(2)} ج.م</strong>
        <span class="badge status-${order.status}">${labels[order.status] || order.status}</span>
        <button class="details-btn">التفاصيل</button>
      </div>
    </article>
  `).join("");

  ordersList.querySelectorAll(".details-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".order-card");
      const order = data.find(o => o.id === card.dataset.id);
      openOrder(order);
    });
  });
}

function updateStats(data) {
  document.getElementById("statAll").textContent = data.length;
  document.getElementById("statNew").textContent = data.filter(o => o.status === "new").length;
  document.getElementById("statPreparing").textContent = data.filter(o => o.status === "preparing").length;
  document.getElementById("statReady").textContent = data.filter(o => o.status === "ready").length;
}

function openOrder(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  orderDetails.innerHTML = `
    <h2>طلب #${order.order_number}</h2>
    <div class="customer-info">
      <p><b>الاسم:</b> ${escapeHtml(order.customer_name)}</p>
      <p><b>الهاتف:</b> ${escapeHtml(order.phone)}</p>
      <p><b>المنطقة:</b> ${escapeHtml(order.area || "-")}</p>
      <p><b>العنوان:</b> ${escapeHtml(order.address || "-")}</p>
      <p><b>ملاحظات:</b> ${escapeHtml(order.notes || "-")}</p>
    </div>
    <h3>الأصناف</h3>
    <div class="items">
      ${items.map(i => `<div><span>${escapeHtml(i.name || "صنف")} × ${Number(i.qty || i.quantity || 1)}</span><b>${Number(i.price || 0).toFixed(2)} ج.م</b></div>`).join("") || "<p>لا توجد أصناف مسجلة</p>"}
    </div>
    <div class="totals">
      <div><span>التوصيل</span><b>${Number(order.delivery_fee || 0).toFixed(2)} ج.م</b></div>
      <div class="grand"><span>الإجمالي</span><b>${Number(order.total || 0).toFixed(2)} ج.م</b></div>
    </div>
    <label>حالة الطلب</label>
    <select id="modalStatus">
      ${Object.entries(labels).map(([value, text]) => `<option value="${value}" ${order.status === value ? "selected" : ""}>${text}</option>`).join("")}
    </select>
    <button id="saveStatus" class="save-btn">حفظ الحالة</button>
    <div id="statusMessage"></div>
  `;

  document.getElementById("saveStatus").addEventListener("click", async () => {
    const newStatus = document.getElementById("modalStatus").value;
    const { error } = await supabaseClient
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", order.id);

    const msg = document.getElementById("statusMessage");
    if (error) msg.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    else {
      msg.innerHTML = '<div class="success">تم تحديث حالة الطلب</div>';
      order.status = newStatus;
      loadOrders();
    }
  });

  orderModal.classList.remove("hidden");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

checkSession();
