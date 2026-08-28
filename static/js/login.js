document.addEventListener("DOMContentLoaded", () => {
    if (usuarioAtual()) {
        window.location.href = "dashboard.html";
        return;
    }

    const form = document.getElementById("loginForm");
    const button = document.getElementById("btnLogin");
    const message = document.getElementById("mensagem");

    form.addEventListener("submit", async event => {
        event.preventDefault();
        button.disabled = true;
        button.textContent = "Entrando...";
        message.textContent = "";

        try {
            const usuario = await apiFetch("/usuarios/login", {
                method: "POST",
                body: {
                    email: document.getElementById("email").value.trim(),
                    senha: document.getElementById("senha").value
                }
            });

            localStorage.setItem("usuarioId", usuario.id);
            localStorage.setItem("usuarioNome", usuario.nome);
            localStorage.setItem("usuarioEmail", usuario.email);
            window.location.href = "dashboard.html";
        } catch (error) {
            message.textContent = error.message;
            message.style.color = "#b42318";
        } finally {
            button.disabled = false;
            button.textContent = "Entrar";
        }
    });
});
