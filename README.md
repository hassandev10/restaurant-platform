# Restaurant Incoming Orders Dashboard Client (Standalone)

تطبيق موظفي المطعم المستقل لإدارة واستلام الطلبات الفورية — منصة المطاعم الذكية في مصر.

---

## 1. Scope & Capabilities

هذا التطبيق هو **عميل مستقل بذاته (Standalone Client)** مخصص لموظفي الصالة والمطبخ (POS Staff Application).

### الميزات التشغيلية الرئيسية:
- **واجهة عربية كاملة (Arabic-First & RTL):** تصميم مريح للعين أثناء ساعات العمل المزدحمة.
- **إدارة دورة حياة الطلبات (State Machine):**
  - جديد (`NEW`) $\rightarrow$ تم التأكيد (`CONFIRMED`) $\rightarrow$ قيد التحضير (`PREPARING`) $\rightarrow$ جاهز للتقديم (`READY`) $\rightarrow$ تم التقديم (`SERVED`).
  - إلغاء آمن مع التحقق ونافذة تأكيد ملزمة لتوثيق السبب.
- **تنبيهات صوتية فورية (Web Audio API):** نغمة تنبيه نقية تعمل محلياً فور وصول أي طلب جديد مع زر كتم/تفعيل وتذكر الإعدادات.
- **تمييز الطلبات المتأخرة:** كشف الطلبات التي تجاوزت 15 دقيقة (أو 7 دقائق للطلبات الجديدة) مع شارات تحذيرية وفلتر مخصص.
- **ترتيب FIFO للمطاعم:** فرز افتراضي يعطي الأولوية للطلبات الأقدم وصولاً.
- **بون طباعة حراري للمطبخ:** معاينة وطباعة بون تحضير الصالة متوافق مع طابعات 80mm.
- **تكامل فوري متعدد التبويبات:** دعم `BroadcastChannel` لتلقي الطلبات فور إرسالها من جهاز العميل دون الحاجة لتحديث الصفحة.

---

## 2. Project Structure

```text
D:\smart-restaurant-dashboard\
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # الخطوط العربية (Cairo, Tajawal), RTL, Sonner Toaster
│   │   ├── globals.css                    # الألوان والسمات وتنسيقات التصميم
│   │   ├── page.tsx                       # توجيه تلقائي مباشر إلى /orders
│   │   └── orders/
│   │       ├── page.tsx                   # الشاشة الرئيسية اللحظية لاستلام الطلبات
│   │       ├── [orderId]/page.tsx         # صفحة تفاصيل الطلب المستقلة
│   │       └── history/page.tsx           # سجل الطلبات السابقة وإحصائيات المبيعات
│   │
│   ├── components/
│   │   └── dashboard/
│   │       ├── dashboard-header.tsx       # ترويسة الشاشة، الساعة، والتنبيهات وحالة "وضع تجريبي"
│   │       ├── order-card.tsx             # كارت الطلب وأزرار الإجراءات السريعة
│   │       ├── order-details-drawer.tsx   # لوحة تفاصيل الفاتورة وسجل الأحداث
│   │       ├── order-status-tabs.tsx      # فلاتر الحالات مع العدادات اللحظية
│   │       ├── order-search-and-sort.tsx  # شريط البحث وفرز الطلبات المتأخرة
│   │       ├── order-cancel-modal.tsx     # نافذة تأكيد الإلغاء واختيار السبب
│   │       └── order-receipt-modal.tsx    # بون الطباعة الحرارية للمطبخ
│   │
│   ├── lib/
│   │   ├── order-workflow.ts              # منطق وقواعد الانتقال بين الحالات والكشف عن التأخير
│   │   ├── sound.ts                       # مُولّد نغمات التنبيه عبر Web Audio API
│   │   ├── formatters.ts                  # تنسيق الجنيه المصري (ج.م) والأوقات باللغة العربية
│   │   └── utils.ts                       # دمج أصناف Tailwind
│   │
│   ├── repositories/
│   │   └── order-repository.ts            # واجهة IOrderRepository ومستودع المحاكاة والتزامن
│   │
│   ├── data/
│   │   ├── mock-orders.ts                 # طلبات مصرية نموذجية مسبقة
│   │   ├── mock-restaurants.ts
│   │   └── mock-tables.ts
│   │
│   └── types/
│       └── order.ts                       # نماذج بيانات الطلب وسجل الأحداث والبنود
│
└── test/
    └── order-workflow.test.ts             # 13 اختبار آلي يغطي كافة سيناريوهات العمل
```

---

## 3. How to Run the Project

افتح موجه الأوامر في مسار المشروع:

```powershell
cd D:\smart-restaurant-dashboard

# تشغيل خادم التطوير
npm run dev

# تشغيل الاختبارات الآلية
npm test

# فحص المعايير البرمجية
npm run lint

# بناء نسخة الإنتاج
npm run build
```

ثم افتح المتصفح على:
**`http://localhost:3000/orders`**
