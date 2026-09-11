# StemVue

> An AI-powered educational animation platform that converts STEM queries and math problems into Manim-rendered visual animated explainer videos.

### Demo Video

<video src="./38a6e1ce-35d4-436d-a346-b7703ea9e5ad.mp4" controls="controls" muted="muted" width="100%"></video>

**Model:** `gemini-flash-3.5`

**Problem:**
> A gas balloon is going up with a constant velocity of $10\text{ m/s}$. When this balloon reached a height of $75\text{ m}$, a stone is dropped from it and balloon keeps moving up with the same velocity. The height of the balloon when the stone hits the ground is $\underline{\hspace{1.5cm}}\text{ m}$. (Take $g = 10\text{ m/s}^2$)

---

## 1. Next.js Frontend Setup

### Clone & Install

```bash
git clone https://github.com/phoenix-xr/StemVue.git
cd StemVue
npm install
```

### Environment Variables (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

# Gemini API (comma-separated for rotation)
GEMINI_API_KEYS=your_gemini_api_key_1,your_gemini_api_key_2

# Rendering Microservice URL (Hugging Face or local container: http://localhost:7860)
RENDER_SERVER_URL=https://phoenixx-stemvue.hf.space
```

### Run Frontend

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 2. Rendering Microservice Setup (FastAPI + Docker)

### Clone from Hugging Face

```bash
git clone https://huggingface.co/spaces/PhoenixX/StemVue stemvue-render-service
cd stemvue-render-service
```

### Environment Variables (`.env`)

Create a `.env` file inside the microservice directory:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_publishable_key
REDIS_URL=rediss://default:your_token@your_redis_host:6379?ssl_cert_reqs=CERT_NONE
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Build & Run with Docker

```bash
# Build the Docker image
docker build -t stemvue-renderer .

# Run the container
docker run -p 7860:7860 --env-file .env stemvue-renderer
```
Microservice runs at [http://localhost:7860](http://localhost:7860)

---

## Architecture

![Architecture Diagram](./diagram.png)