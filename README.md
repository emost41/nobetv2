# HadiÇöz (hadicoz)

KBB odaklı, uzmanlık öğrencileri ve asistanlar için mobil uyumlu soru çözme uygulaması (MVP web sürümü).

## Özellikler
- 5 şıklı (A-B-C-D-E) soru kartı
- Web'de şık seçerek cevaplama
- Yukarı swipe ile kısa açıklama + kaynak paneli
- Sağ/sol swipe (veya buton) ile eminlik işaretleme
- Yanlış ve emin değilim cevaplarını tekrar kuyruğuna alma
- LocalStorage ile temel ilerleme kaydı
- 10 soruluk günlük oturum ilerleme göstergesi

## Çalıştırma
```bash
cd apps/web
python3 -m http.server 4173
```

Tarayıcıda aç:
- `http://localhost:4173`

## İçerik notu
KBB kaynak kitaplarından içerik türetilebilir; ancak telifli metinler birebir kopyalanmadan, lisans ve editör doğrulama süreçleri ile ilerlenmelidir.

## Dokümanlar
- PRD: `PRD.md`
- İçerik politikası: `docs/content-policy.md`
