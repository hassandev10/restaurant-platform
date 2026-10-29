-- Seed data for Egyptian Smart Restaurant Platform

-- 1. Restaurants & Branches
INSERT INTO restaurants (id, name, slug, description, logo_url, currency, is_open, estimated_prep_minutes)
VALUES 
('rest-01', 'مطعم الزيتونة', 'demo-restaurant', 'أكل طازة وطعم يلمّ العيلة • أشهى المشويات المصرية والمأكولات الشرقية الأصيلة', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=250&q=80', 'EGP', true, 25),
('rest-02', 'مطعم الزيتونة', 'al-zaytouna', 'أكل طازة وطعم يلمّ العيلة • أشهى المشويات المصرية والمأكولات الشرقية الأصيلة', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=250&q=80', 'EGP', true, 25)
ON CONFLICT (id) DO NOTHING;

INSERT INTO restaurant_branches (id, restaurant_id, name)
VALUES 
('branch-01', 'rest-01', 'فرع المعادي - القاهرة')
ON CONFLICT (id) DO NOTHING;

-- 2. Dining Tables
INSERT INTO dining_tables (id, restaurant_id, branch_id, table_number, name, token, status)
VALUES 
('table-04', 'rest-01', 'branch-01', '4', 'طاولة 4', 'demo-table-token', 'ACTIVE'),
('table-02', 'rest-01', 'branch-01', '2', 'طاولة 2', 'tbl-02', 'ACTIVE'),
('table-07', 'rest-01', 'branch-01', '7', 'طاولة 7 (التراس)', 'tbl-07', 'ACTIVE'),
('table-12', 'rest-01', 'branch-01', '12', 'طاولة 12 (VIP)', 'tbl-12', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 3. Categories
INSERT INTO menu_categories (id, restaurant_id, name_ar, name_en, display_order, is_active, icon_name)
VALUES
('grills', 'rest-01', 'المشويات واللحوم', 'Grills & Meat', 1, true, 'Flame'),
('breakfast', 'rest-01', 'الفطار والشرقي', 'Breakfast', 2, true, 'Egg'),
('appetizers', 'rest-01', 'المقبلات والشوربة', 'Appetizers & Soup', 3, true, 'Soup'),
('pizza', 'rest-01', 'البيتزا والفطير', 'Pizza & Pies', 4, true, 'Pizza'),
('burgers', 'rest-01', 'البرجر والسندوتشات', 'Burgers & Sandwiches', 5, true, 'Sandwich'),
('drinks', 'rest-01', 'المشروبات والعصائر', 'Beverages & Juices', 6, true, 'Coffee'),
('desserts', 'rest-01', 'الحلويات الشرقية', 'Oriental Desserts', 7, true, 'Cake')
ON CONFLICT (id) DO NOTHING;

-- 4. Products
INSERT INTO menu_products (id, restaurant_id, category_id, name_ar, name_en, description, price, image_url, is_available, is_featured, badge, display_order)
VALUES
('prod-01', 'rest-01', 'grills', 'كباب وكفتة مشوية على الفحم', 'Charcoal Grilled Kabab & Kofta', 'لحم بلدي متبل بخلطة الزيتونة السرية، مشوي على الفحم، يقدم مع خبز بلدي ساخن، طحينة، وسلطة خضراء طازجة.', 195.00, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=700&q=80', true, true, 'الأكثر طلبًا', 1),
('prod-02', 'rest-01', 'grills', 'شيش طاووق متبل بالزبادي والأعشاب', 'Marinated Shish Tawook', 'صدور دجاج طرية متبلة بالزبادي والليمون والأعشاب الطازجة، مشوية مع الفلفل الألوان والبصل على أسياخ خشبية.', 150.00, 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=700&q=80', true, true, NULL, 2),
('prod-03', 'rest-01', 'grills', 'صينية مشويات الزيتونة العائلية (VIP)', 'Family Mixed Grills Platter', 'تشكيلة فاخرة تكفي 5 أفراد: كباب، كفتة، ريش بتلو، شيش طاووق، مع سيرفيس أرز وسلطات كامل.', 680.00, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80', false, false, 'توصية الشيف', 3),
('prod-04', 'rest-01', 'breakfast', 'فطير مشلتت فلاحي بالسمن البلدي', 'Traditional Egyptian Feteer Meshaltet', 'فطير مورق على أصوله مخبوز بالسمن البلدي الصافي في الفرن البلدي، يقدم مع العسل الأسود بالطحينة والجبنة القديمة.', 95.00, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80', true, true, 'الأكثر طلبًا', 4),
('prod-05', 'rest-01', 'breakfast', 'طاسة بيض بالبسطرمة الإسكندراني', 'Scrambled Eggs with Alexandrian Pastirma', 'بيض بلدي طازج مطهو بالسمنة البلدي مع شرائح بسطرمة إسكندراني متبلة بالثوم والحلبة.', 65.00, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=700&q=80', true, false, NULL, 5),
('prod-06', 'rest-01', 'appetizers', 'شوربة كوارع مخلية بالليمون والثوم', 'Boneless Cow Trotters Soup', 'شوربة غنية ومركزة متبلة بالمستكة والحبهان مع قطع الكوارع المخلية الطرية وتقلية الثوم والخل.', 120.00, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=700&q=80', true, false, 'توصية الشيف', 6),
('prod-07', 'rest-01', 'appetizers', 'ورق عنب مصري بالكوارع والمكسرات', 'Stuffed Vine Leaves with Meat', 'طاجن ورق عنب بلدي محشو بالأرز والخلطة المصرية مع ليمون ودبس رمان ومكسرات محمصة.', 110.00, 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=700&q=80', true, true, NULL, 7),
('prod-08', 'rest-01', 'pizza', 'حواوشي بلدي مخصوص بالجبنة الموتزاريلا', 'Special Egyptian Hawawshi with Mozzarella', 'لحم بلدي مفروم مع البصل والفلفل الحار والبهارات محشو داخل رغيف خبز بلدي ومغطى بجبنة موتزاريلا سايحة.', 85.00, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=700&q=80', true, true, 'الأكثر طلبًا', 8),
('prod-09', 'rest-01', 'burgers', 'برجر لحم بلدي مشوي دبل بالجبنة الشيدر', 'Double Charcoal Grilled Beef Burger', 'قطعتان من لحم البرجر البلدي الصافي مشوية على الجريل مع صوص الزيتونة السري، خس، طماطم، وخيار مخلل.', 135.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80', true, false, NULL, 9),
('prod-10', 'rest-01', 'drinks', 'عصير قصب مصري طازج مثلج', 'Fresh Iced Sugarcane Juice', 'عصير قصب طازج معصور فور الطلب مع مكعبات ثلج منعشة، المشروب المصري الأصيل الأول.', 25.00, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=700&q=80', true, true, NULL, 10),
('prod-11', 'rest-01', 'drinks', 'كركديه أسواني مثلج طبيعي', 'Iced Hibiscus Juice (Karkadeh)', 'منقوع أزهار الكركديه الأسواني الطبيعي، طعم مظبوط بين المزازة والسكر، منعش جداً بعد الأكلات الدسمة.', 30.00, 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=700&q=80', true, false, 'نباتي', 11),
('prod-12', 'rest-01', 'desserts', 'طاجن أم علي بالمكسرات والقشطة البلدي', 'Traditional Om Ali with Cream & Nuts', 'رقائق الميل فاي الهشة مغمورة في الحليب الساخن والقشطة الفلاحي مع تشكيلة مكسرات محمصة وزبيب، مخبوزة في الفرن.', 60.00, 'https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=700&q=80', true, true, 'الأكثر طلبًا', 12)
ON CONFLICT (id) DO NOTHING;

-- 5. Option Groups & Options
-- prod-01 (Kabab & Kofta)
INSERT INTO product_option_groups (id, product_id, name_ar, selection_type, is_required, min_selections, max_selections, display_order)
VALUES
('opt-size-grill', 'prod-01', 'الحجم والوزن', 'SINGLE', true, 1, 1, 1),
('opt-addons-grill', 'prod-01', 'إضافات ومقبلات جانبية', 'MULTIPLE', false, 0, 4, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_options (id, group_id, name_ar, price_delta, is_available, display_order)
VALUES
('size-half', 'opt-size-grill', 'وجبة نصف كيلو', 0.00, true, 1),
('size-kilo', 'opt-size-grill', 'وجبة كيلو كامل', 180.00, true, 2),
('extra-tahina', 'opt-addons-grill', 'صوص طحينة سمسم إضافي', 15.00, true, 1),
('extra-rice', 'opt-addons-grill', 'أرز بسمتي بالمكسرات والزبيب', 40.00, true, 2),
('extra-hawawshi', 'opt-addons-grill', 'رغيف حواوشي بلدي سناك', 45.00, true, 3),
('extra-pickles', 'opt-addons-grill', 'مخلل بلدي مشكل', 15.00, true, 4)
ON CONFLICT (id) DO NOTHING;

-- prod-02 (Shish Tawook)
INSERT INTO product_option_groups (id, product_id, name_ar, selection_type, is_required, min_selections, max_selections, display_order)
VALUES
('opt-side-tawook', 'prod-02', 'اختيار الصنف الجانبي', 'SINGLE', true, 1, 1, 1),
('opt-sauce-tawook', 'prod-02', 'الصوصات المفضلة', 'MULTIPLE', false, 0, 2, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_options (id, group_id, name_ar, price_delta, is_available, display_order)
VALUES
('side-fries', 'opt-side-tawook', 'بطاطس محمرة مقرمشة', 0.00, true, 1),
('side-rice', 'opt-side-tawook', 'أرز بسمتي أصفر', 15.00, true, 2),
('sauce-garlic', 'opt-sauce-tawook', 'تومية شامية غنية', 15.00, true, 1),
('sauce-spicy', 'opt-sauce-tawook', 'شطة حارة متبلة', 10.00, true, 2)
ON CONFLICT (id) DO NOTHING;

-- 6. Staff Users (password: password123)
INSERT INTO staff_users (id, restaurant_id, branch_id, username, password_hash, name, role, is_active)
VALUES
('staff-01', 'rest-01', 'branch-01', 'admin', '$2a$10$7usoIzti0Yo8n4zO7nLkIerL6MaJtk40fOLYLQeVJNd1Mw8LP8bpO', 'الكابتن أحمد (مشرف الصالة)', 'ADMIN', true),
('staff-02', 'rest-01', 'branch-01', 'kitchen', '$2a$10$7usoIzti0Yo8n4zO7nLkIerL6MaJtk40fOLYLQeVJNd1Mw8LP8bpO', 'الشيف محمود (رئيس المطبخ)', 'KITCHEN', true)
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- 7. Sample Initial Orders (Matching mock-orders for seamless testing)
INSERT INTO orders (id, order_number, restaurant_id, branch_id, table_id, table_name, status, subtotal, total, payment_status, created_at, updated_at)
VALUES
('ord_live_01', 'EG-1048', 'rest-01', 'branch-01', 'table-04', 'طاولة 4', 'NEW', 195.00, 195.00, 'PENDING_CASHIER', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '4 minutes'),
('ord_live_02', 'EG-1045', 'rest-01', 'branch-01', 'table-07', 'طاولة 7 (التراس)', 'CONFIRMED', 150.00, 150.00, 'PENDING_CASHIER', NOW() - INTERVAL '12 minutes', NOW() - INTERVAL '8 minutes'),
('ord_live_03', 'EG-1042', 'rest-01', 'branch-01', 'table-02', 'طاولة 2', 'PREPARING', 95.00, 95.00, 'PENDING_CASHIER', NOW() - INTERVAL '19 minutes', NOW() - INTERVAL '11 minutes'),
('ord_live_04', 'EG-1039', 'rest-01', 'branch-01', 'table-12', 'طاولة 12 (VIP)', 'READY', 85.00, 85.00, 'PENDING_CASHIER', NOW() - INTERVAL '24 minutes', NOW() - INTERVAL '3 minutes'),
('ord_hist_01', 'EG-1035', 'rest-01', 'branch-01', 'table-04', 'طاولة 4', 'SERVED', 280.00, 280.00, 'PAID', NOW() - INTERVAL '60 minutes', NOW() - INTERVAL '35 minutes'),
('ord_hist_02', 'EG-1031', 'rest-01', 'branch-01', 'table-02', 'طاولة 2', 'CANCELLED', 120.00, 120.00, 'CANCELLED', NOW() - INTERVAL '90 minutes', NOW() - INTERVAL '85 minutes')
ON CONFLICT (id) DO NOTHING;

-- Order items for ord_live_01
INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, line_total)
VALUES
('item_01_1', 'ord_live_01', 'prod-01', 'كباب وكفتة مشوية على الفحم', 195.00, 1, 'طحينة زيادة وسلطة بلدي إضافية من فضلك', 195.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_item_options (id, order_item_id, group_id, group_name_ar_snapshot, option_id, option_name_ar_snapshot, price_delta_snapshot)
VALUES
('oio_01_1', 'item_01_1', 'opt-size-grill', 'الحجم والوزن', 'size-half', 'وجبة نصف كيلو', 0.00)
ON CONFLICT (id) DO NOTHING;

-- Order status events for ord_live_01
INSERT INTO order_status_events (id, order_id, status, actor, note, timestamp)
VALUES
('ev_01_1', 'ord_live_01', 'NEW', 'العميل (عبر QR طاولة 4)', 'تم استلام الطلب من طاولة 4 بانتظار تأكيد مشرف الصالة', NOW() - INTERVAL '4 minutes')
ON CONFLICT (id) DO NOTHING;

-- Order status events for ord_live_02
INSERT INTO order_status_events (id, order_id, status, actor, note, timestamp)
VALUES
('ev_02_1', 'ord_live_02', 'NEW', 'العميل (عبر QR طاولة 7)', 'تم استلام الطلب', NOW() - INTERVAL '12 minutes'),
('ev_02_2', 'ord_live_02', 'CONFIRMED', 'الكابتن أحمد (مشرف الصالة)', 'تم تأكيد الطلب وإرساله إلى المطبخ', NOW() - INTERVAL '8 minutes')
ON CONFLICT (id) DO NOTHING;
