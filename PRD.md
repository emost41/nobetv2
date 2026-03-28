# HadiÇöz PRD (v0.2)

## 1. Ürün Özeti
HadiÇöz; KBB alanında board sınavına hazırlanan uzmanlık öğrencileri ve asistan hekimler için mobil uyumlu, hızlı soru çözme ve tekrar odaklı bir web uygulamasıdır.

## 2. Hedef Kitle
- Uzmanlık öğrencileri
- Asistan hekimler

## 3. Değer Önerisi
- Nöbet aralarında 5-10 dakikalık mikro seanslarla düzenli çalışma
- Eminlik verisi ile öğrenme açıklarını daha doğru yakalama
- Kısa açıklama + kaynakla hızlı pekiştirme

## 4. MVP Özellikleri
### 4.1 Soru Akışı
- Kart tabanlı arayüz
- 5 şık (A/B/C/D/E)
- Web'de doğrudan şık seçimi

### 4.2 Gesture Etkileşimi
- Yukarı swipe: Açıklama paneli (kısa açıklama + kaynak)
- Sağ swipe: Doğru/Eminim geri bildirimi
- Sol swipe: Yanlış/Emin değilim geri bildirimi
- Desktop fallback: Eminim / Emin değilim butonları

### 4.3 Tekrar Sistemi
- Yanlış cevap: yüksek öncelikli tekrar
- Emin değilim işareti: orta öncelikli tekrar
- Kuyruk kaydı: soru kimliği + öncelik + zaman

### 4.4 Oyunlaştırma
- Günlük hedef: 10 soru
- İlerleme çubuğu
- Oturum özeti ekranı

## 5. Kullanıcı Hikayeleri
1. Asistan hekim olarak günlük 10 soruluk bir hedefi tamamlamak istiyorum.
2. Cevapladıktan sonra yukarı swipe ile açıklamayı hızlıca görmek istiyorum.
3. Emin olmadığım soruların otomatik tekrar kuyruğuna düşmesini istiyorum.

## 6. Başarı Kriterleri
- Kullanıcı ilk 2 dakika içinde ilk soruyu cevaplayabilmeli.
- Günlük hedef tamamlanma oranı takip edilebilmeli.
- Yanlış + emin değilim soruları tekrar kuyruğuna yazılmalı.

## 7. Teknik Kapsam
- Aşama 1: Statik web MVP (tamamlandı)
- Aşama 2: Auth + backend + içerik paneli
- Aşama 3: Gerçek spaced repetition zamanlaması ve analitik

## 8. İçerik Kaynak Yönetimi
- Kaynak kitaplardan birebir kopya yok
- Lisans/izin doğrulaması zorunlu
- Her soru için referans alanı zorunlu
- Editör hekim doğrulaması olmadan yayın yok

## 9. Sonraki Sprint Planı
- Supabase auth + kullanıcı profili
- Kalıcı tekrar kuyruğu ve günlük plan
- KBB konu filtreleri (otoloji/rinoloji/baş-boyun)
