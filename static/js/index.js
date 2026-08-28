document.addEventListener("DOMContentLoaded", async () => {
    if (!exigirLogin()) return;
    setupUserArea();

    const user = usuarioAtual();
    const container = document.getElementById("listaTurmasDashboard");

    try {
        const turmas = await apiFetch(`/turmas/instrutor/${user.id}`);
        document.getElementById("statTurmas").textContent = turmas.length;

        if (!turmas.length) {
            document.getElementById("statAlunos").textContent = "0";
            document.getElementById("statUCs").textContent = "0";
            document.getElementById("statAulas").textContent = "0";
            container.innerHTML = `<div class="empty" style="grid-column:1/-1"><strong>Nenhuma turma cadastrada</strong>Crie sua primeira turma para começar a organizar alunos e frequência.<div style="margin-top:14px"><a class="btn btn-primary" href="turma.html">Criar primeira turma</a></div></div>`;
            return;
        }

        const dados = await Promise.all(turmas.map(async turma => {
            const [alunos, ucs] = await Promise.all([
                apiFetch(`/alunos/turma/${turma.id}`),
                apiFetch(`/ucs/turma/${turma.id}`)
            ]);
            return { turma, alunos, ucs };
        }));

        const totalAlunos = dados.reduce((s, d) => s + d.alunos.length, 0);
        const totalUCs = dados.reduce((s, d) => s + d.ucs.length, 0);
        const aulasPromises = dados.flatMap(d => d.ucs.map(uc => apiFetch(`/frequencias/aulas?turmaId=${d.turma.id}&ucId=${uc.id}`)));
        const aulas = (await Promise.all(aulasPromises)).reduce((s, a) => s + a.length, 0);

        document.getElementById("statAlunos").textContent = totalAlunos;
        document.getElementById("statUCs").textContent = totalUCs;
        document.getElementById("statAulas").textContent = aulas;

        container.innerHTML = dados.map(({ turma, alunos, ucs }) => `
            <article class="stat">
                <div class="label">Turma</div>
                <div class="value" style="font-size:18px">${escapeHtml(turma.nome)}</div>
                <div class="hint">${alunos.length} aluno(s) · ${ucs.length} UC(s)</div>
                <div style="margin-top:14px"><a class="btn btn-secondary btn-small" href="turma.html?turmaId=${turma.id}">Abrir turma</a></div>
            </article>
        `).join("");
    } catch (error) {
        showToast(error.message, "error");
        container.innerHTML = `<div class="empty" style="grid-column:1/-1"><strong>Não foi possível carregar o painel</strong>Verifique a conexão com o servidor.</div>`;
    }
});
