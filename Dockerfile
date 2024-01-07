# # Use a base image that includes build tools
# FROM debian:buster-slim as build-stage

# # Install build dependencies
# RUN apt-get update && apt-get install -y \
#     build-essential \
#     pkg-config \
#     git \
#     curl \
#     libpng-dev \
#     libjpeg-dev \
#     libtiff-dev \
#     libwebp-dev \
#     libheif-dev \
#     libde265-dev \
#     x265 \
#     # Add other dependencies if necessary
#     && rm -rf /var/lib/apt/lists/*

# # Install libvips with support for HEIC
# RUN curl -L https://github.com/libvips/libvips/releases/download/v8.12.1/vips-8.12.1.tar.gz | tar zx \
#     && cd vips-8.12.1 \
#     && ./configure --enable-heic=yes \
#     && make \
#     && make install \
#     && ldconfig

# Use an official Node.js runtime as a new stage
FROM node:18

# Copy libvips binaries and libraries from the build-stage
COPY --from=build-stage /usr/local/lib /usr/local/lib
COPY --from=build-stage /usr/local/bin /usr/local/bin

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Expose ports
EXPOSE 3010

# Command to start the application
CMD ["npm", "start"]
