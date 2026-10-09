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


// إدارة صور المنيو: صور الملفات تُرفع إلى Supabase Storage، والرابط يُحفظ في menu_item_images.
const menuItemsList = document.getElementById("menuItemsList");
const menuMessage = document.getElementById("menuMessage");
const refreshMenuBtn = document.getElementById("refreshMenuBtn");
const menuSeed = [{"name":"علبة كشري 20","cat":"كشرى"},{"name":"علبة كشري 30","cat":"كشرى"},{"name":"علبة كشري 40","cat":"كشرى"},{"name":"علبة كشري 50","cat":"كشرى"},{"name":"إضافة بصل","cat":"كشرى"},{"name":"إضافة حمص","cat":"كشرى"},{"name":"إضافة عدس","cat":"كشرى"},{"name":"إضافة صلصة","cat":"كشرى"},{"name":"عيش توست","cat":"كشرى"},{"name":"دقة","cat":"كشرى"},{"name":"دقة طماطم","cat":"كشرى"},{"name":"رز بلبن عادي","cat":"كشرى"},{"name":"رز بلبن فرن","cat":"كشرى"},{"name":"رز بلبن قشطة وعسل ومكسرات عادي","cat":"كشرى"},{"name":"رز بلبن فرن قشطة وعسل ومكسرات","cat":"كشرى"},{"name":"طاجن فراخ","cat":"طواجن"},{"name":"طاجن لحمه","cat":"طواجن"},{"name":"طاجن موزاريلا وسط فراخ","cat":"طواجن"},{"name":"طاجن موزاريلا كبير فراخ","cat":"طواجن"},{"name":"طاجن موزاريلا وسط لحمه","cat":"طواجن"},{"name":"طاجن موزاريلا كبير لحمه","cat":"طواجن"},{"name":"طاجن ميكس فراخ","cat":"طواجن"},{"name":"طاجن ميكس لحمه","cat":"طواجن"},{"name":"إضافة فراخ","cat":"طواجن"},{"name":"إضافة لحمه","cat":"طواجن"},{"name":"بيتزا مارجريتا","cat":"بيتزا"},{"name":"بيتزا مكس جبن","cat":"بيتزا"},{"name":"بيتزا كيري","cat":"بيتزا"},{"name":"بيتزا خضروات","cat":"بيتزا"},{"name":"بيتزا تشيكن","cat":"بيتزا"},{"name":"بيتزا تشيكن بانيه","cat":"بيتزا"},{"name":"بيتزا تشيكن كرانشي","cat":"بيتزا"},{"name":"بيتزا تشيكن مكس","cat":"بيتزا"},{"name":"بيتزا تشيكن ستريبس","cat":"بيتزا"},{"name":"بيتزا تشيكن شاورما","cat":"بيتزا"},{"name":"بيتزا تشيكن شيش","cat":"بيتزا"},{"name":"بيتزا سموك تورك","cat":"بيتزا"},{"name":"بيتزا فونجي مشروم","cat":"بيتزا"},{"name":"بيتزا سوبر سوبريم","cat":"بيتزا"},{"name":"بيتزا لحمة","cat":"بيتزا"},{"name":"بيتزا شاورما لحمة","cat":"بيتزا"},{"name":"بيتزا سجق","cat":"بيتزا"},{"name":"بيتزا سوسيس","cat":"بيتزا"},{"name":"بيتزا سلامي","cat":"بيتزا"},{"name":"بيتزا بسطرمة","cat":"بيتزا"},{"name":"بيتزا تونة","cat":"بيتزا"},{"name":"فطيرة مكس جبن","cat":"فطاير"},{"name":"فطيرة رومي","cat":"فطاير"},{"name":"فطيرة كيري","cat":"فطاير"},{"name":"فطيرة موتزاريلا","cat":"فطاير"},{"name":"فطيرة مشروم","cat":"فطاير"},{"name":"فطيرة شاورما","cat":"فطاير"},{"name":"فطيرة ستريبس","cat":"فطاير"},{"name":"فطيرة بانيه","cat":"فطاير"},{"name":"فطيرة شيش","cat":"فطاير"},{"name":"فطيرة مكس دجاج","cat":"فطاير"},{"name":"فطيرة دجاج","cat":"فطاير"},{"name":"فطيرة سجق","cat":"فطاير"},{"name":"فطيرة لحمة","cat":"فطاير"},{"name":"فطيرة سوسيس","cat":"فطاير"},{"name":"فطيرة سلامي","cat":"فطاير"},{"name":"فطيرة بسطرمة","cat":"فطاير"},{"name":"فطيرة مكس لحوم","cat":"فطاير"},{"name":"فطيرة شوكولاتة","cat":"فطاير"},{"name":"فطيرة شوكولاتة ومكسرات","cat":"فطاير"},{"name":"تورتة قدورة","cat":"فطاير"},{"name":"فطيرة بسبوسة وقشطة","cat":"فطاير"},{"name":"فطيرة بسبوسة وكنافة","cat":"فطاير"},{"name":"فطيرة سكر","cat":"فطاير"},{"name":"فطيرة بغاشة","cat":"فطاير"},{"name":"موزيكا","cat":"فطاير"},{"name":"قشطوطة","cat":"فطاير"},{"name":"كنافة","cat":"فطاير"},{"name":"بسبوسة","cat":"فطاير"},{"name":"كاستر","cat":"فطاير"},{"name":"مكسرات","cat":"فطاير"},{"name":"كريب بطاطس","cat":"كريب"},{"name":"كريب مشروم","cat":"كريب"},{"name":"كريب رومي","cat":"كريب"},{"name":"كريب موتزاريلا","cat":"كريب"},{"name":"كريب كيري","cat":"كريب"},{"name":"كريب ميكس لبن","cat":"كريب"},{"name":"كريب بانيه","cat":"كريب"},{"name":"كريب بانيه حار","cat":"كريب"},{"name":"كريب سوبر كرانشي","cat":"كريب"},{"name":"كريب زنجر","cat":"كريب"},{"name":"كريب تشيكن فاهيتا","cat":"كريب"},{"name":"كريب شيش طاووق","cat":"كريب"},{"name":"كريب مشوي صدور","cat":"كريب"},{"name":"كريب تشيكن فرايداي","cat":"كريب"},{"name":"كريب شاورما دجاج","cat":"كريب"},{"name":"كريب برجر","cat":"كريب"},{"name":"كريب كفتة مشوي","cat":"كريب"},{"name":"كريب هوت دوج","cat":"كريب"},{"name":"كريب شاورما لحمه","cat":"كريب"},{"name":"كريب فاهيتا لحمه","cat":"كريب"},{"name":"كريب سجق اسكندراني","cat":"كريب"},{"name":"كريب بسطرمه","cat":"كريب"},{"name":"كريب سلامي","cat":"كريب"},{"name":"كريب ميكس دجاج","cat":"كريب"},{"name":"كريب ميكس لحوم","cat":"كريب"},{"name":"كريب استربس رانش","cat":"كريب"},{"name":"كريب استربس كيري","cat":"كريب"},{"name":"كريب الجامد","cat":"كريب"},{"name":"كريب يوجي","cat":"كريب"},{"name":"كريب العملاق","cat":"كريب"},{"name":"كريب قدورة","cat":"كريب"},{"name":"كريب شوكولاتة","cat":"كريب"},{"name":"كريب شوكولاتة موز","cat":"كريب"},{"name":"كريب شوكولاتة مكسرات","cat":"كريب"},{"name":"كريب أوريو","cat":"كريب"},{"name":"كريب هوهوز","cat":"كريب"},{"name":"كريب لوتس","cat":"كريب"},{"name":"صاروخ فطير جبنة","cat":"الصواريخ"},{"name":"صاروخ فطير ميكس","cat":"الصواريخ"},{"name":"صاروخ فطير دجاج","cat":"الصواريخ"},{"name":"صاروخ فطير لحمة","cat":"الصواريخ"},{"name":"كانز","cat":"المشروبات"},{"name":"لتر كولا","cat":"المشروبات"},{"name":"مياه معدنية ص","cat":"المشروبات"},{"name":"مياه معدنية ك","cat":"المشروبات"},{"name":"العروض الجديدة","cat":"العروض"},{"name":"أصناف جديدة","cat":"الجديد"}];

function setMenuMessage(message, kind="") {
  if (!menuMessage) return;
  menuMessage.className = "menu-message " + kind;
  menuMessage.textContent = message;
}

async function ensureMenuRows() {
  // إدخال أسماء الأصناف الافتراضية تلقائيًا عند أول فتح للوحة، دون تغيير الأسعار أو الطلبات.
  const {error} = await supabaseClient.from("menu_item_images").upsert(
    menuSeed.map(x => ({item_name:x.name, category:x.cat})),
    {onConflict:"item_name", ignoreDuplicates:true}
  );
  if(error) throw error;
}

async function loadMenuImages() {
  if (!menuItemsList) return;
  menuItemsList.innerHTML = '<div class="empty">جاري تحميل الأصناف...</div>';
  setMenuMessage("");
  try {
    await ensureMenuRows();
    const {data,error} = await supabaseClient.from("menu_item_images").select("id,item_name,category,image_url").order("category").order("item_name");
    if(error) throw error;
    if(!data || !data.length){ menuItemsList.innerHTML='<div class="empty">لا توجد أصناف.</div>'; return; }
    menuItemsList.innerHTML = data.map(item => `
      <article class="menu-item-card" data-id="${escapeHtml(item.id)}">
        ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.item_name)}" loading="lazy">` : '<div class="no-image">🍽</div>'}
        <div><div class="menu-item-title">${escapeHtml(item.item_name)}</div><div class="menu-item-category">${escapeHtml(item.category || "بدون قسم")}</div></div>
        <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="صورة ${escapeHtml(item.item_name)}">
        <button class="save-menu-image">${item.image_url ? "تغيير الصورة" : "رفع صورة الصنف"}</button>
        ${item.image_url ? '<button class="secondary remove-menu-image">حذف الصورة</button>' : ''}
      </article>`).join("");
    menuItemsList.querySelectorAll(".save-menu-image").forEach(button => button.addEventListener("click", async () => {
      const card=button.closest(".menu-item-card"); const item=data.find(x=>String(x.id)===card.dataset.id);
      const file=card.querySelector('input[type="file"]').files[0];
      if(!file){setMenuMessage("اختار صورة للصنف الأول.","error");return;}
      if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setMenuMessage("الصيغ المسموحة JPG وPNG وWebP فقط.","error");return;}
      if(file.size>5*1024*1024){setMenuMessage("حجم الصورة لازم يكون أقل من 5 ميجابايت.","error");return;}
      button.disabled=true;button.textContent="جاري الرفع...";setMenuMessage("");
      try{
        const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
        const path=`items/${item.id}-${Date.now()}.${ext}`;
        const {error:uploadError}=await supabaseClient.storage.from("menu-images").upload(path,file,{upsert:true,contentType:file.type});
        if(uploadError) throw uploadError;
        const {data:publicData}=supabaseClient.storage.from("menu-images").getPublicUrl(path);
        const {error:updateError}=await supabaseClient.from("menu_item_images").update({image_url:publicData.publicUrl,updated_at:new Date().toISOString()}).eq("id",item.id);
        if(updateError) throw updateError;
        setMenuMessage(`تم حفظ صورة ${item.item_name}. ستظهر في منيو العملاء بعد تحديثه.`,"success");
        await loadMenuImages();
      }catch(e){setMenuMessage("فشل رفع الصورة: "+(e.message||"خطأ غير معروف"),"error");button.disabled=false;button.textContent="إعادة المحاولة";}
    }));
    menuItemsList.querySelectorAll(".remove-menu-image").forEach(button=>button.addEventListener("click",async()=>{
      const card=button.closest(".menu-item-card");const item=data.find(x=>String(x.id)===card.dataset.id);
      if(!confirm(`حذف صورة ${item.item_name}؟`)) return;
      button.disabled=true;
      const {error}=await supabaseClient.from("menu_item_images").update({image_url:null,updated_at:new Date().toISOString()}).eq("id",item.id);
      if(error){setMenuMessage("تعذر حذف الصورة: "+error.message,"error");button.disabled=false;return;}
      setMenuMessage("تم حذف الصورة الخاصة بالصنف.","success");await loadMenuImages();
    }));
  }catch(e){
    menuItemsList.innerHTML='<div class="empty">تعذر تحميل أصناف المنيو.</div>';
    setMenuMessage("لازم تنفّذ ملف SQL المرفق مرة واحدة في Supabase SQL Editor. التفاصيل: "+(e.message||"تعذر الاتصال"),"error");
  }
}
if(refreshMenuBtn) refreshMenuBtn.addEventListener("click",loadMenuImages);
const originalShowApp = showApp;
showApp = function(){ originalShowApp(); loadMenuImages(); };
