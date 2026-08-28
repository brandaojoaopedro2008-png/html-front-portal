const API_URL = "/api";

function usuarioAtual() {
    const id = localStorage.getItem("usuarioId");
    const nome = localStorage.getItem("usuarioNome");
    const email = localStorage.getItem("usuarioEmail");
    return id ? { id: Number(id), nome: nome || "Usuário", email: email || "" } : null;
}

function exigirLogin() {
    if (!usuarioAtual()) {
        window.location.href = "login.html";
        return false;
    }
    return true;
}

async function logout() {
    try { await fetch(`${API_URL}/usuarios/logout`, { method: "POST", credentials: "same-origin" }); } catch {}
    localStorage.removeItem("usuarioId");
    localStorage.removeItem("usuarioNome");
    localStorage.removeItem("usuarioEmail");
    localStorage.removeItem("turmaIdAtual");
    window.location.href = "login.html";
}

async function apiFetch(path, options = {}) {
    const config = { ...options, headers: { ...(options.headers || {}) } };
    if (config.body && typeof config.body !== "string") {
        config.headers["Content-Type"] = "application/json";
        config.body = JSON.stringify(config.body);
    }

    const response = await fetch(`${API_URL}${path}`, config);
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!response.ok) {
        const message = typeof data === "string" ? data : (data?.message || "Não foi possível concluir a operação.");
        throw new Error(message);
    }
    return data;
}

function initials(nome) {
    return (nome || "U").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function setupUserArea() {
    const user = usuarioAtual();
    document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = user?.nome || "Usuário");
    document.querySelectorAll("[data-user-email]").forEach(el => el.textContent = user?.email || "Instrutor");
    document.querySelectorAll("[data-user-initials]").forEach(el => el.textContent = initials(user?.nome));
    document.querySelectorAll("[data-action='logout']").forEach(el => el.addEventListener("click", logout));
}

function showToast(message, type = "success") {
    let area = document.querySelector(".toast-area");
    if (!area) {
        area = document.createElement("div");
        area.className = "toast-area";
        document.body.appendChild(area);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    area.appendChild(toast);
    setTimeout(() => toast.remove(), 3600);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
}
