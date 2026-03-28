# HadiÇöz PRD (v0.1)

## 1. Ürün Özeti
HadiÇöz, uzmanlık öğrencileri ve asistan hekimler için KBB odaklı, mobil uyumlu web tabanlı bir soru çözme uygulamasıdır. Kullanıcılar soruları kart formatında çözer, swipe hareketleriyle hızlı etkileşim kurar ve zayıf olduğu soruları tekrar kuyruğunda görerek board sınavına sistematik şekilde hazırlanır.

## 2. Hedef Kitle
- Uzmanlık öğrencileri
- Asistan hekimler
- Board sınavına hazırlanan hekimler

## 3. Kapsam (MVP)
### 3.1 Soru Akışı
- Soru kartı + 5 şık (A, B, C, D, E)
- Web üzerinde kullanıcı şıkkı tıklayarak cevap verir
- Cevap verildikten sonra durum etiketi görünür (doğru/yanlış)

### 3.2 Gesture Tasarımı
- Sağa kaydırma: Doğru / Eminim
- Sola kaydırma: Yanlış / Emin değilim
- Aşağıdan yukarı kaydırma: Açıklama panelini açar
- Açıklama paneli kısa açıklama + kaynak içerir

### 3.3 Öğrenme Döngüsü
- Yanlış veya emin olunmayan sorular "Tekrar Et" kuyruğuna alınır
- Basit spaced repetition adımları: 1, 3, 7, 14 gün

### 3.4 Oyunlaştırma
- Günlük seri (streak)
- Toplam çözülen soru
- Doğruluk yüzdesi

## 4. Kapsam Dışı (v1 sonrası)
- Çoklu branş desteği (ilk sürümde sadece KBB)
- Gerçek zamanlı leaderboard
- Native mobil uygulama

## 5. Kullanıcı Hikayeleri
1. Asistan hekim olarak nöbet arasında kısa sürede 10 soru çözmek istiyorum.
2. Yanlış yaptığım soruları ayrı bir kuyruğa atıp tekrar görmek istiyorum.
3. Cevaptan sonra yukarı kaydırıp kısa açıklamayı ve kaynağı görmek istiyorum.

## 6. Başarı Kriterleri
- İlk oturumda kullanıcı en az 10 soruyu başarıyla tamamlayabilmeli.
- Ortalama soru cevaplama süresi < 45 saniye.
- İlk hafta tekrar kuyruğuna düşen soruların en az %60'ı yeniden cevaplanmalı.

## 7. Teknik Yaklaşım (MVP)
- Mobil uyumlu web arayüzü
- Basit istemci taraflı prototip (JSON soru datası)
- Sonraki fazda kimlik doğrulama + kalıcı veritabanı

## 8. Veri Şeması (MVP prototip)
- question_id
- stem
- options[A-E]
- correct_option
- explanation_short
- source
- topic (KBB alt konusu)

## 9. Riskler ve Önlemler
- İçerik lisans riski: Kaynak hakları yazılı izinle doğrulanmalı.
- Tıbbi doğruluk riski: İçerik editör onay süreci zorunlu olmalı.
- Yanlış güven (overconfidence): Eminim/emin değilim verisi analiz edilerek tekrar kuyruğuna beslenmeli.

## 10. Yol Haritası
- Sprint 1: Prototip UI + swipe etkileşimi + soru akışı
- Sprint 2: Tekrar kuyruğu + local istatistikler
- Sprint 3: İçerik yönetimi + backend entegrasyonu
