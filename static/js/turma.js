let turmaAtual = null;
let turmaIdAtual = null;
let alunosAtuais = [];
let ucsAtuais = [];
let modalSubmit = null;

function queryTurmaInicial() {
    return new URLSearchParams(window.location.search).get("turmaId") || localStorage.getItem("turmaIdAtual");
}

async function carregarListaTurmas() {
    const user = usuarioAtual();
    const turmas = await apiFetch(`/turmas/instrutor/${user.id}`);
    const select = document.getElementById("selectTurma");
    select.innerHTML = `<option value="">Selecione uma turma</option>`;
    turmas.forEach(turma => {
        const option = document.createElement("option");
        option.value = turma.id;
        option.textContent = turma.nome;
        select.appendChild(option);
    });
    return turmas;
}

async function carregarTurma(id) {
    turmaAtual = await apiFetch(`/turmas/${id}`);
    const user = usuarioAtual();
    if (turmaAtual.instrutor?.id && Number(turmaAtual.instrutor.id) !== user.id) {
        throw new Error("A turma selecionada não pertence ao usuário atual.");
    }
    turmaIdAtual = turmaAtual.id;
    localStorage.setItem("turmaIdAtual", turmaIdAtual);
    document.getElementById("selectTurma").value = turmaIdAtual;
    document.getElementById("infoTurmaSelecionada").value = turmaAtual.nome;
    document.getElementById("painelTurma").style.display = "block";
    document.getElementById("estadoInicial").style.display = "none";
    await Promise.all([carregarAlunos(), carregarUCs()]);
}

async function carregarAlunos() {
    alunosAtuais = await apiFetch(`/alunos/turma/${turmaIdAtual}`);
    document.getElementById("contadorAlunos").textContent = alunosAtuais.length;
    const tbody = document.getElementById("corpoTabelaAlunos");
    if (!alunosAtuais.length) {
        tbody.innerHTML = `<tr><td colspan="3"><div class="empty">Nenhum aluno cadastrado nesta turma.</div></td></tr>`;
        return;
    }
    tbody.innerHTML = alunosAtuais.map(aluno => `
        <tr>
            <td><strong>${escapeHtml(aluno.nome)}</strong></td>
            <td>${escapeHtml(aluno.matricula)}</td>
            <td><div class="row-actions">
                <button class="btn btn-secondary btn-small" data-edit-aluno="${aluno.id}">Editar</button>
                <button class="btn btn-danger btn-small" data-delete-aluno="${aluno.id}">Excluir</button>
            </div></td>
        </tr>`).join("");

    tbody.querySelectorAll("[data-edit-aluno]").forEach(btn => btn.addEventListener("click", () => abrirModalAluno(Number(btn.dataset.editAluno))));
    tbody.querySelectorAll("[data-delete-aluno]").forEach(btn => btn.addEventListener("click", () => excluirAluno(Number(btn.dataset.deleteAluno))));
}

async function carregarUCs() {
    ucsAtuais = await apiFetch(`/ucs/turma/${turmaIdAtual}`);
    document.getElementById("contadorUCs").textContent = ucsAtuais.length;
    const tbody = document.getElementById("corpoTabelaUCs");
    if (!ucsAtuais.length) {
        tbody.innerHTML = `<tr><td colspan="4"><div class="empty">Nenhuma unidade curricular cadastrada.</div></td></tr>`;
        return;
    }

    const rows = await Promise.all(ucsAtuais.map(async uc => {
        let aulas = [];
        try { aulas = await apiFetch(`/frequencias/aulas?turmaId=${turmaIdAtual}&ucId=${uc.id}`); } catch {}
        return { uc, aulas: aulas.length };
    }));

    tbody.innerHTML = rows.map(({ uc, aulas }) => `
        <tr>
            <td><strong>${escapeHtml(uc.nome)}</strong></td>
            <td>${uc.totalAulas}</td>
            <td>${aulas} de ${uc.totalAulas}</td>
            <td><div class="row-actions">
                <button class="btn btn-secondary btn-small" data-edit-uc="${uc.id}">Editar</button>
                <button class="btn btn-danger btn-small" data-delete-uc="${uc.id}">Excluir</button>
            </div></td>
        </tr>`).join("");

    tbody.querySelectorAll("[data-edit-uc]").forEach(btn => btn.addEventListener("click", () => abrirModalUC(Number(btn.dataset.editUc))));
    tbody.querySelectorAll("[data-delete-uc]").forEach(btn => btn.addEventListener("click", () => excluirUC(Number(btn.dataset.deleteUc))));
}

function abrirModal(titulo, descricao, fields, onSubmit) {
    document.getElementById("modalTitulo").textContent = titulo;
    document.getElementById("modalDescricao").textContent = descricao;
    const form = document.getElementById("modalForm");
    form.innerHTML = fields.map(f => `<div class="field ${f.full ? "full" : ""}"><label for="${f.id}">${escapeHtml(f.label)}</label><input id="${f.id}" type="${f.type || "text"}" value="${escapeHtml(f.value ?? "")}" ${f.min ? `min="${f.min}"` : ""} ${f.required !== false ? "required" : ""}></div>`).join("");
    document.getElementById("modalBackdrop").classList.add("open");
    modalSubmit = onSubmit;
}

function fecharModal() {
    document.getElementById("modalBackdrop").classList.remove("open");
    modalSubmit = null;
}

function abrirModalAluno(id = null) {
    const aluno = alunosAtuais.find(a => a.id === id);
    abrirModal(id ? "Editar aluno" : "Adicionar aluno", "Informe os dados cadastrais do aluno.", [
        { id: "modalNome", label: "Nome completo", value: aluno?.nome || "", full: true },
        { id: "modalMatricula", label: "Matrícula", value: aluno?.matricula || "" }
    ], async () => {
        const body = { nome: document.getElementById("modalNome").value.trim(), matricula: document.getElementById("modalMatricula").value.trim() };
        if (id) await apiFetch(`/alunos/${id}`, { method: "PUT", body });
        else await apiFetch(`/alunos/turma/${turmaIdAtual}`, { method: "POST", body });
        fecharModal(); await carregarAlunos(); showToast(id ? "Aluno atualizado." : "Aluno cadastrado.");
    });
}

function abrirModalUC(id = null) {
    const uc = ucsAtuais.find(u => u.id === id);
    abrirModal(id ? "Editar unidade curricular" : "Adicionar unidade curricular", "Defina o nome e o total de aulas previsto.", [
        { id: "modalNomeUC", label: "Nome da unidade curricular", value: uc?.nome || "", full: true },
        { id: "modalTotalAulas", label: "Total de aulas", type: "number", min: 1, value: uc?.totalAulas || 1 }
    ], async () => {
        const body = { nome: document.getElementById("modalNomeUC").value.trim(), totalAulas: Number(document.getElementById("modalTotalAulas").value) };
        if (id) await apiFetch(`/ucs/${id}`, { method: "PUT", body });
        else await apiFetch(`/ucs/turma/${turmaIdAtual}`, { method: "POST", body });
        fecharModal(); await carregarUCs(); showToast(id ? "Unidade curricular atualizada." : "Unidade curricular cadastrada.");
    });
}

async function criarTurma() {
    abrirModal("Nova turma", "Crie uma turma vinculada ao seu usuário.", [
        { id: "modalNomeTurma", label: "Nome da turma", full: true }
    ], async () => {
        const user = usuarioAtual();
        const body = { nome: document.getElementById("modalNomeTurma").value.trim(), instrutor: { id: user.id } };
        const turma = await apiFetch("/turmas", { method: "POST", body });
        fecharModal();
        await carregarListaTurmas();
        await carregarTurma(turma.id);
        showToast("Turma criada.");
    });
}

async function editarTurma() {
    abrirModal("Editar turma", "Altere o nome sem modificar os alunos ou o histórico.", [
        { id: "modalNomeTurma", label: "Nome da turma", value: turmaAtual.nome, full: true }
    ], async () => {
        const turma = await apiFetch(`/turmas/${turmaIdAtual}`, { method: "PUT", body: { nome: document.getElementById("modalNomeTurma").value.trim() } });
        turmaAtual = turma;
        fecharModal(); await carregarListaTurmas(); await carregarTurma(turma.id); showToast("Turma atualizada.");
    });
}

async function excluirAluno(id) {
    if (!confirm("Excluir este aluno? O sistema bloqueará a operação caso exista histórico de frequência.")) return;
    try { await apiFetch(`/alunos/${id}`, { method: "DELETE" }); await carregarAlunos(); showToast("Aluno excluído."); }
    catch (error) { showToast(error.message, "error"); }
}

async function excluirUC(id) {
    if (!confirm("Excluir esta unidade curricular? A operação será bloqueada se houver histórico de frequência.")) return;
    try { await apiFetch(`/ucs/${id}`, { method: "DELETE" }); await carregarUCs(); showToast("Unidade curricular excluída."); }
    catch (error) { showToast(error.message, "error"); }
}

async function excluirTurma() {
    if (!confirm("Excluir esta turma? A operação só será permitida se ela não possuir alunos, unidades curriculares ou histórico.")) return;
    try {
        await apiFetch(`/turmas/${turmaIdAtual}`, { method: "DELETE" });
        turmaAtual = null; turmaIdAtual = null; localStorage.removeItem("turmaIdAtual");
        document.getElementById("painelTurma").style.display = "none";
        document.getElementById("estadoInicial").style.display = "block";
        document.getElementById("infoTurmaSelecionada").value = "Nenhuma turma selecionada";
        await carregarListaTurmas();
        showToast("Turma excluída.");
    } catch (error) { showToast(error.message, "error"); }
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!exigirLogin()) return;
    setupUserArea();

    document.getElementById("selectTurma").addEventListener("change", async event => {
        if (!event.target.value) return;
        try { await carregarTurma(Number(event.target.value)); }
        catch (error) { showToast(error.message, "error"); }
    });
    document.getElementById("btnNovaTurma").addEventListener("click", criarTurma);
    document.getElementById("btnNovoAluno").addEventListener("click", () => abrirModalAluno());
    document.getElementById("btnNovaUC").addEventListener("click", () => abrirModalUC());
    document.getElementById("btnEditarTurma").addEventListener("click", editarTurma);
    document.getElementById("btnExcluirTurma").addEventListener("click", excluirTurma);
    document.getElementById("btnAcessarFrequencia").addEventListener("click", () => {
        if (turmaIdAtual) window.location.href = `frequencia.html?turmaId=${turmaIdAtual}`;
    });

    document.getElementById("modalFechar").addEventListener("click", fecharModal);
    document.getElementById("modalCancelar").addEventListener("click", fecharModal);
    document.getElementById("modalBackdrop").addEventListener("click", event => { if (event.target.id === "modalBackdrop") fecharModal(); });
    document.getElementById("modalForm").addEventListener("submit", async event => {
        event.preventDefault();
        if (!modalSubmit) return;
        try { await modalSubmit(); } catch (error) { showToast(error.message, "error"); }
    });

    try {
        const turmas = await carregarListaTurmas();
        const inicial = queryTurmaInicial();
        if (inicial && turmas.some(t => Number(t.id) === Number(inicial))) await carregarTurma(Number(inicial));
    } catch (error) { showToast(error.message, "error"); }
});
