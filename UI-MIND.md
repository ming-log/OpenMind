# Role & Goal
You are an elite Frontend Engineer and Senior UI/UX Designer. The current implementation looks unpolished, resembles an early 2010s "plastic/glossy" web app, and suffers from blurry, low-resolution icons. 

Your mission is to perform a high-fidelity visual overhaul to make it look hyper-modern, clean, and built to premium 2026 SaaS standards. 

Please provide the updated Tailwind CSS classes (or clean modern CSS) and component code structures. Ensure all spacing follows a strict 8px grid system with smooth transitions (`transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`).

---

## 1. Iconography Overhaul (CRITICAL FIX)
* **Problem:** Current icons are blurry, misaligned, and look like low-res raster assets.
* **Fix:** Replace **ALL** icons across the app with crisp, pixel-perfect, vector-based SVG icons (use a modern package like `lucide-react`, `heroicons`, or pure optimized SVGs).
    * **Top Toolbar:** Create, Upload, Export (MD/PNG), and Refresh buttons must use unified 18px SVG icons with a clean stroke (`stroke-width: 1.75`).
    * **Floating Canvas Controls:** Zoom In/Out, Fit-to-screen, and Center icons must be perfectly centered within their bounding boxes.
    * **Node Collapse/Expand:** The `+` and `-` icons on the node edges must be sharp, high-definition vectors.

## 2. Eliminate "Plastic" Aesthetics & Fix Shadows
* **Problem:** The interface has heavy, solid borders and thick shadows that create a dated, cheap plastic look.
* **Fix:** * Remove heavy text-shadows, inner shadows, or harsh borders.
    * **Canvas Background:** Use a very clean, neutral light gray (`#F8F9FA` or `#FAFAFB`).
    * **Subtle Grid:** The grid lines must be extremely faint (`#E2E8F0` with `0.4` opacity), visible enough to guide layout but entirely non-intrusive.
    * **Modern Elevation (The Card Effect):** Instead of heavy drop-shadows, use modern, layered micro-shadows for elements floating on the canvas:
      `box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03), 0 4px 6px -1px rgba(0, 0, 0, 0.02);`

## 3. Premium Mind-Map Node Design
* **Nodes Styling:** Nodes should look like premium, flat white card stock floating cleanly above the grid. 
    * `background-color: #FFFFFF;`
    * `border: 1px solid #E2E8F0;`
    * `border-radius: 10px;`
    * **Padding:** Increase inner horizontal padding (`px-5 py-3`) so the text has room to breathe.
* **Central Node ("OpenMind"):** Give it a slight, elegant differentiation (e.g., a subtle 1.5px border utilizing a refined tech-purple like `#6366F1` or `#4F46E5` and a 5% opacity tint background), rather than a heavy full-color fill.
* **Active/Selected Node State:** When a node is clicked, apply a crisp external ring (`ring-2 ring-indigo-500 ring-offset-2`) and highlight its connecting SVG path dynamically.

## 4. Refined Sidebar & Status Tags
* **Active Card:** The selected item in the "任务列表" sidebar should have a full-width background fill of `#F5F3FF` (or a 5% tint of your primary brand color), a crisp text color (`#4F46E5`), and a sharp vertical indicator bar on the left edge.
* **Status Tags (Pills):** The current text dots look unpolished. Refactor them into clean, high-contrast status tags:
    * **已保存 / 已保存:** Background `#DCFCE7`, Text `#15803D`, Font Weight `Medium`.
    * **未保存:** Background `#FEF3C7`, Text `#B45309`, Font Weight `Medium`.
* Add a small, high-definition SVG dot or icon inside the status pills to improve scannability.

## 5. Layout & Control Alignment
* **Top-Right View Toggle ("导图" / "Markdown"):** Convert these two separate blocks into a single **Segmented Control (Sliding Tab)**. The container should have a subtle background (`#F1F5F9`), and the active selection should smoothly slide a white card (`#FFFFFF` with a micro-shadow) underneath the active text.
* **Floating Controls Bar:** Apply a modern glassmorphism touch: `background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(226, 232, 240, 0.8); border-radius: 12px;`.
* **Bottom Status Bar:** Ensure the entire bottom row is perfectly aligned on a single baseline. File info (`OpenMind.md`) goes to the bottom-left, while sync statuses are cleanly grouped as tags on the bottom-right.