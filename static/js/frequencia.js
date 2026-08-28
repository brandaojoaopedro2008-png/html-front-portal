let turmaId = null;
let turma = null;
let alunos = [];
let ucs = [];
let aulas = [];
let relatorio = null;
let presencas = new Map();

function getTurmaId() {
    return new URLSearchParams(window.location.search).get("turmaId");
}

async function carregar() {
    turmaId = getTurmaId();
    if (!turmaId) {
        window.location.href = "turma.html";
        return;
    }

    const user = usuarioAtual();
    turma = await apiFetch(`/turmas/${turmaId}`);
    if (turma.instrutor?.id && Number(turma.instrutor.id) !== user.id) throw new Error("A turma não pertence ao usuário atual.");

    document.getElementById("turma").value = turma.nome;
    document.getElementById("btnVoltarTurma").href = `turma.html?turmaId=${turmaId}`;

    [alunos, ucs] = await Promise.all([
        apiFetch(`/alunos/turma/${turmaId}`),
        apiFetch(`/ucs/turma/${turmaId}`)
    ]);

    const select = document.getElementById("uc");
    select.innerHTML = `<option value="">Selecione uma UC</option>` + ucs.map(uc => `<option value="${uc.id}">${escapeHtml(uc.nome)} — ${uc.totalAulas} aulas</option>`).join("");

    if (!alunos.length) {
        document.getElementById("listaAlunos").innerHTML = `<tr><td colspan="4"><div class="empty"><strong>Turma sem alunos</strong>Cadastre os alunos antes de registrar uma chamada.</div></td></tr>`;
        document.getElementById("btnSalvar").disabled = true;
    }
}

async function carregarUC() {
    const ucId = document.getElementById("uc").value;
    presencas.clear();
    if (!ucId) {
        aulas = [];
        relatorio = null;
        renderizar();
        return;
    }

    const uc = ucs.find(item => Number(item.id) === Number(ucId));
    aulas = await apiFetch(`/frequencias/aulas?turmaId=${turmaId}&ucId=${ucId}`);
    relatorio = await apiFetch(`/frequencias/relatorio?turmaId=${turmaId}&ucId=${ucId}`);

    const proxima = aulas.length ? Math.max(...aulas.map(a => a.numeroAula)) + 1 : 1;
    document.getElementById("numeroAula").value = proxima;
    document.getElementById("numeroAula").max = uc.totalAulas;
    document.getElementById("dataAula").value = aulas.length ? aulas[aulas.length - 1].data : new Date().toISOString().slice(0, 10);

    alunos.forEach(aluno => {
        const info = relatorio.alunos.find(item => Number(item.id) === Number(aluno.id));
        const ultimo = info?.faltas?.length ? !info.faltas[info.faltas.length - 1] : true;
        presencas.set(aluno.id, ultimo);
    });
    renderizar();
}

function renderizar() {
    const tbody = document.getElementById("listaAlunos");
    const resumo = document.getElementById("resumoChamada");

    if (!document.getElementById("uc").value) {
        tbody.innerHTML = `<tr><td colspan="4"><div class="empty"><strong>Selecione uma unidade curricular</strong>A lista de alunos será preparada para a chamada.</div></td></tr>`;
        resumo.textContent = "Selecione uma unidade curricular para iniciar.";
        renderizarAulas();
        renderizarAlertas();
        return;
    }

    const uc = ucs.find(item => Number(item.id) === Number(document.getElementById("uc").value));
    resumo.textContent = `${alunos.length} aluno(s) · Aula ${document.getElementById("numeroAula").value} de ${uc.totalAulas}`;

    tbody.innerHTML = alunos.map(aluno => {
        const presente = presencas.get(aluno.id) !== false;
        const info = relatorio?.alunos?.find(item => Number(item.id) === Number(aluno.id));
        const percentual = info?.percentualPresenca ?? 100;
        const status = info?.alertaPercentual || info?.temDuasFaltasConsecutivas ? "Atenção" : "Regular";
        const badge = status === "Atenção" ? "badge-warning" : "badge-success";
        return `<tr>
            <td><strong>${escapeHtml(aluno.nome)}</strong></td>
            <td>${escapeHtml(aluno.matricula)}</td>
            <td><div class="attendance-control"><div class="attendance-toggle">
                <button type="button" class="${presente ? "active present" : ""}" data-presente="true" data-aluno="${aluno.id}">Presente</button>
                <button type="button" class="${!presente ? "active absent" : ""}" data-presente="false" data-aluno="${aluno.id}">Ausente</button>
            </div></div></td>
            <td><div style="display:flex;align-items:center;gap:8px"><span class="badge ${badge}">${status}</span><div class="progress"><span style="width:${Math.max(0, Math.min(100, percentual))}%"></span></div><small>${percentual.toFixed(1)}%</small></div></td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-aluno]").forEach(button => button.addEventListener("click", () => {
        presencas.set(Number(button.dataset.aluno), button.dataset.presente === "true");
        renderizar();
    }));

    renderizarAulas();
    renderizarAlertas();
}

function renderizarAulas() {
    const tbody = document.getElementById("listaAulas");
    if (!aulas.length) {
        tbody.innerHTML = `<tr><td colspan="3"><div class="empty">Nenhuma aula registrada para esta UC.</div></td></tr>`;
        return;
    }
    tbody.innerHTML = aulas.map(aula => `<tr><td>Aula ${aula.numeroAula}</td><td>${escapeHtml(aula.data)}</td><td><span class="badge badge-success">Concluída</span></td></tr>`).join("");
}

function renderizarAlertas() {
    const container = document.getElementById("alertasFrequencia");
    const alertas = relatorio?.alertas || [];
    if (!alertas.length) {
        container.innerHTML = `<div class="empty"><strong>Nenhum alerta</strong>Não há alunos em situação de alerta nesta UC.</div>`;
        return;
    }
    container.innerHTML = `<div class="alert-box">${alertas.map(alerta => `<div class="alert-item"><strong>${escapeHtml(alerta.alunoNome)}</strong><div class="help">${escapeHtml(alerta.alunoMatricula)}</div><div style="margin-top:6px">${escapeHtml(alerta.mensagem)}</div></div>`).join("")}</div>`;
}

async function salvarFrequencia() {
    const ucId = Number(document.getElementById("uc").value);
    const data = document.getElementById("dataAula").value;
    const numeroAula = Number(document.getElementById("numeroAula").value);
    const uc = ucs.find(item => Number(item.id) === ucId);

    if (!uc) return showToast("Selecione uma unidade curricular.", "error");
    if (!data) return showToast("Informe a data da aula.", "error");
    if (numeroAula < 1 || numeroAula > uc.totalAulas) return showToast(`Informe uma aula entre 1 e ${uc.totalAulas}.`, "error");
    if (presencas.size !== alunos.length) return showToast("Marque a situação de todos os alunos.", "error");

    const button = document.getElementById("btnSalvar");
    button.disabled = true;
    button.textContent = "Salvando...";
    try {
        await apiFetch("/frequencias/salvar-aula", {
            method: "POST",
            body: {
                numeroAula,
                data,
                ucId,
                presencas: alunos.map(aluno => ({ alunoId: aluno.id, presente: presencas.get(aluno.id) }))
            }
        });
        showToast(`Aula ${numeroAula} registrada com sucesso.`);
        await carregarUC();
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        button.disabled = false;
        button.textContent = "Salvar frequência";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!exigirLogin()) return;
    setupUserArea();
    try {
        await carregar();
        document.getElementById("uc").addEventListener("change", () => carregarUC().catch(error => showToast(error.message, "error")));
        document.getElementById("btnSalvar").addEventListener("click", salvarFrequencia);
        renderizar();
    } catch (error) {
        showToast(error.message, "error");
        setTimeout(() => window.location.href = "turma.html", 1000);
    }
});
