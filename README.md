# SERVER_GUIDE

Bu rehber, sunucu kurulumu ve yönetimi hakkında temel bilgiler sağlar.

## İçerik
- Temel Sunucu Yapılandırması
- Güvenlik Ayarları
- Performans Optimizasyonları
- Docker Kurulumu ve Kullanımı
- Nginx Ters Proxy Yapılandırması

## Nginx Ters Proxy Yapılandırması
Nginx, yüksek performanslı bir web sunucusu ve ters proxy sunucusudur.

1.  **Kurulum:** İşletim sisteminize uygun şekilde Nginx'i kurun (örn: `sudo apt install nginx` for Ubuntu).
2.  **Temel Yapılandırma:** `/etc/nginx/sites-available/default` dosyasını düzenleyerek ters proxy yapılandırmasını yapabilirsiniz.
    ```nginx
    server {
        listen 80;
        server_name example.com;

        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
    ```
3.  **Yeniden Başlatma:** Yapılandırma değişikliklerinden sonra Nginx'i yeniden başlatın: `sudo systemctl restart nginx`.
