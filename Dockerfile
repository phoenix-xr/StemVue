FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies cleanly
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the Next.js application
COPY . .

# Build the application for production
RUN npm run build

# Hugging Face Spaces require running as a non-root user (UID 1000)
# Transfer ownership of the build output and directory
RUN chown -R 1000:1000 /app
USER 1000

# Expose the default Hugging Face Spaces port
EXPOSE 7860

# Start the Next.js production server on port 7860
CMD ["npm", "start", "--", "-p", "7860"]
