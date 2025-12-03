# Sử dụng base image là Node.js
FROM node:18-alpine

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy package.json và package-lock.json (hoặc yarn.lock)
COPY package*.json ./
COPY tsconfig.json ./

# Cài đặt tất cả dependencies (bao gồm devDependencies cho development)
RUN npm install

# Copy toàn bộ mã nguồn và .env
COPY ./src ./src
COPY .env .env

# Port ứng dụng lắng nghe
EXPOSE 3000 3001

# Lệnh chạy ứng dụng khi container khởi động (development mode)
CMD ["npm", "run", "start"]