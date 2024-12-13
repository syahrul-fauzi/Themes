# Gunakan image Ghost LTS resmi berbasis Alpine (lebih ringan)
FROM ghost:4-alpine

# Set working directory untuk Ghost
WORKDIR /var/lib/ghost

# Menyalin tema atau file konfigurasi kustom (jika ada)
COPY ./themes /var/lib/ghost/content/themes

# Mengubah pemilik untuk memastikan Ghost dapat mengakses file tema
RUN chown -R node:node /var/lib/ghost/content/themes

# Expose port 2368 untuk akses ke aplikasi Ghost
EXPOSE 2368

# Image Ghost sudah otomatis menjalankan server Ghost, jadi tidak perlu menambahkan CMD
