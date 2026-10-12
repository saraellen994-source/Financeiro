
/* =====================================================
   GOSSIP GIRL FINANCE
   Upper East Side • Your money, your rules.
   ===================================================== */

"use strict";

/* -------------------- CONFIGURAÇÕES -------------------- */

const STORAGE_KEY = "gossipGirlFinance_v1";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const money = value =>
    Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const uid = () =>
    window.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);

const defaultData = () => ({
    transactions: [],
    goals: [],
    cards: [],
    purchases: [],
    budget: 0,
    events: []
});

let data = loadData();
let incomeExpenseChart = null;
let categoryChart = null;

/* -------------------- SALVAMENTO -------------------- */

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) return defaultData();

        const parsed = JSON.parse(saved);

        return {
            ...defaultData(),
            ...parsed,
            transactions: Array.isArray(parsed.transactions)
                ? parsed.transactions : [],
            goals: Array.isArray(parsed.goals) ? parsed.goals : [],
            cards: Array.isArray(parsed.cards) ? parsed.cards : [],
            purchases: Array.isArray(parsed.purchases)
                ? parsed.purchases : [],
            events: Array.isArray(parsed.events) ? parsed.events : []
        };
    } catch (error) {
        console.error("Não foi possível carregar os dados:", error);
        return defaultData();
    }
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("Não foi possível salvar os dados:", error);
        notify("Não consegui salvar. Confere o espaço disponível no navegador.");
        return false;
    }
}

/* -------------------- NOTIFICAÇÕES -------------------- */

function notify(message) {
    let container = $(".toast-container");

    if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);

    window.setTimeout(() => toast.remove(), 3500);
}

/* -------------------- NAVEGAÇÃO -------------------- */

function navigateTo(pageName) {
    const pages = $$(".page");
    const links = $$(".sidebar nav a, .sidebar nav button, .nav-link");

    let target = $(`#${CSS.escape(pageName)}`);

    if (!target) {
        target = $(`[data-page="${CSS.escape(pageName)}"]`);
    }

    if (!target) return;

    pages.forEach(page => page.classList.remove("active"));
    target.classList.add("active");

    links.forEach(link => {
        const linkPage =
            link.dataset.page ||
            link.getAttribute("href")?.replace("#", "") ||
            link.dataset.target;

        link.classList.toggle("active", linkPage === pageName);
    });

    const pageNameElement = $("#currentPageName");

    if (pageNameElement) {
        const activeLink = links.find(link =>
            (link.dataset.page ||
                link.getAttribute("href")?.replace("#", "") ||
                link.dataset.target) === pageName
        );

        pageNameElement.textContent =
            activeLink?.textContent?.trim() || pageName;
    }

    $("#sidebar")?.classList.remove("open");

    if (pageName === "reports") renderReports();
    if (pageName === "spreadsheet") renderSpreadsheet();
}

function setupNavigation() {
    $$(".sidebar nav a, .sidebar nav button, .nav-link").forEach(link => {
        link.addEventListener("click", event => {
            const pageName =
                link.dataset.page ||
                link.getAttribute("href")?.replace("#", "") ||
                link.dataset.target;

            if (!pageName) return;

            const target = $(`#${CSS.escape(pageName)}`);

            if (target || $(`[data-page="${CSS.escape(pageName)}"]`)) {
                event.preventDefault();
                navigateTo(pageName);
            }
        });
    });

    $("#menuToggle")?.addEventListener("click", () => {
        $("#sidebar")?.classList.toggle("open");
    });

    document.addEventListener("click", event => {
        const sidebar = $("#sidebar");
        const toggle = $("#menuToggle");

        if (
            window.innerWidth <= 760 &&
            sidebar?.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !toggle?.contains(event.target)
        ) {
            sidebar.classList.remove("open");
        }
    });
}

/* -------------------- CÁLCULOS FINANCEIROS -------------------- */

function getMonthTransactions(month = today().slice(0, 7)) {
    return data.transactions.filter(item =>
        String(item.date || "").startsWith(month)
    );
}

function calculateTotals(transactions = getMonthTransactions()) {
    const income = transactions
        .filter(item => item.type === "income")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const expenses = transactions
        .filter(item => item.type === "expense")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const saved = data.goals.reduce(
        (sum, goal) => sum + Number(goal.saved || 0), 0
    );

    const balance = data.transactions.reduce((sum, item) => {
        const amount = Number(item.amount || 0);
        return sum + (item.type === "income" ? amount : -amount);
    }, 0);

    return { income, expenses, saved, balance };
}

function updateDashboard() {
    const monthInput = $("#dashboardMonth");
    const selectedMonth = monthInput?.value || today().slice(0, 7);
    const transactions = getMonthTransactions(selectedMonth);

    const totals = calculateTotals(transactions);

    setText("#totalBalance", money(totals.balance));
    setText("#totalIncome", money(totals.income));
    setText("#totalExpenses", money(totals.expenses));
    setText("#totalSaved", money(totals.saved));

    const budget = Number(data.budget || 0);
    const usedPercentage = budget > 0
        ? Math.min((totals.expenses / budget) * 100, 100)
        : 0;

    setText("#budgetLimitDisplay", money(budget));
    setText("#budgetUsed", money(totals.expenses));
    setText("#budgetPercentage", `${Math.round(usedPercentage)}%`);

    const progress = $("#budgetProgress");

    if (progress) {
        progress.style.width = `${usedPercentage}%`;
        progress.setAttribute("role", "progressbar");
        progress.setAttribute("aria-valuenow", String(Math.round(usedPercentage)));
        progress.setAttribute("aria-valuemin", "0");
        progress.setAttribute("aria-valuemax", "100");
    }

    renderRecentTransactions(transactions);
    renderDashboardGoals();
    renderCharts(transactions);
}

function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
}

/* -------------------- TRANSAÇÕES -------------------- */

function setupTransactionForm() {
    const form = $("#transactionForm");
    if (!form) return;

    const dateInput = $("#transactionDate");
    if (dateInput && !dateInput.value) dateInput.value = today();

    form.addEventListener("submit", event => {
        event.preventDefault();

        const description = $("#transactionDescription")?.value.trim();
        const amount = Number($("#transactionAmount")?.value);
        const type = $("#transactionType")?.value;
        const category = $("#transactionCategory")?.value;
        const date = dateInput?.value || today();

        if (!description || !Number.isFinite(amount) || amount <= 0) {
            notify("Preenche a descrição e coloca um valor válido, florzinha.");
            return;
        }

        if (!["income", "expense"].includes(type)) {
            notify("Escolhe se é uma entrada ou uma despesa.");
            return;
        }

        data.transactions.push({
            id: uid(),
            description,
            amount,
            type,
            category: category || "Outros",
            date,
            payment: $("#transactionPayment")?.value || "",
            notes: $("#transactionNotes")?.value.trim() || "",
            createdAt: new Date().toISOString()
        });

        if (!saveData()) return;

        form.reset();
        if (dateInput) dateInput.value = today();

        renderAll();
        notify("Transação salva com sucesso! 💋");
    });
}

function deleteTransaction(id) {
    const item = data.transactions.find(transaction => transaction.id === id);

    if (!item) return;

    if (!confirm(`Excluir a transação "${item.description}"?`)) return;

    data.transactions = data.transactions.filter(transaction => transaction.id !== id);

    saveData();
    renderAll();
    notify("Transação excluída.");
}

function renderTransactions() {
    const tableBody = $("#transactionsTableBody") ||
        $("#transactionsTable tbody") ||
        $("#transactionsList");

    if (!tableBody) return;

    const search = ($("#transactionSearch")?.value || "").toLowerCase();
    const typeFilter = $("#transactionFilterType")?.value || "all";
    const categoryFilter = $("#transactionFilterCategory")?.value || "all";
    const monthFilter = $("#transactionFilterMonth")?.value || "all";

    const transactions = [...data.transactions]
        .filter(item => {
            const matchesSearch =
                `${item.description} ${item.category} ${item.notes || ""}`
                    .toLowerCase().includes(search);

            const matchesType =
                typeFilter === "all" || item.type === typeFilter;

            const matchesCategory =
                categoryFilter === "all" || item.category === categoryFilter;

            const matchesMonth =
                monthFilter === "all" ||
                String(item.date).startsWith(monthFilter);

            return matchesSearch && matchesType &&
                matchesCategory && matchesMonth;
        })
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    if (!transactions.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Nenhum gasto ou recebimento por aqui ainda. ✨
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = transactions.map(item => `
        <tr>
            <td>${escapeHTML(formatDate(item.date))}</td>
            <td>${escapeHTML(item.description)}</td>
            <td>${escapeHTML(item.category)}</td>
            <td>${escapeHTML(item.payment || "—")}</td>
            <td>
                <span class="badge ${item.type === "income" ? "badge-green" : "badge-red"}">
                    ${item.type === "income" ? "Entrada" : "Despesa"}
                </span>
            </td>
            <td class="${item.type === "income" ? "amount-income" : "amount-expense"}">
                ${item.type === "income" ? "+" : "−"}${money(item.amount)}
            </td>
            <td>
                <button class="btn btn-danger btn-sm"
                    data-delete-transaction="${escapeHTML(item.id)}"
                    type="button">
                    Excluir
                </button>
            </td>
        </tr>
    `).join("");
}

function renderRecentTransactions(transactions = getMonthTransactions()) {
    const container = $("#recentTransactions");
    if (!container) return;

    const recent = [...transactions]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 5);

    if (!recent.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🖤</div>
                Ainda não tem movimentações. Começa adicionando uma!
            </div>`;
        return;
    }

    container.innerHTML = recent.map(item => `
        <div class="event-item">
            <div class="event-date">
                <strong>${escapeHTML(String(item.date || "").slice(8, 10) || "—")}</strong>
                <span>${escapeHTML(String(item.date || "").slice(5, 7) || "—")}</span>
            </div>
            <div class="event-info" style="flex:1">
                <h4>${escapeHTML(item.description)}</h4>
                <p>${escapeHTML(item.category)}</p>
            </div>
            <strong class="${item.type === "income" ? "amount-income" : "amount-expense"}">
                ${item.type === "income" ? "+" : "−"}${money(item.amount)}
            </strong>
        </div>
    `).join("");
}

function formatDate(date) {
    if (!date) return "—";

    const parts = String(date).split("-");
    if (parts.length !== 3) return date;

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/* -------------------- ORÇAMENTO -------------------- */

function setupBudgetForm() {
    const form = $("#budgetForm");
    if (!form) return;

    const input = $("#budgetAmount");
    if (input) input.value = data.budget || "";

    form.addEventListener("submit", event => {
        event.preventDefault();

        const amount = Number(input?.value);

        if (!Number.isFinite(amount) || amount < 0) {
            notify("Coloca um limite válido.");
            return;
        }

        data.budget = amount;

        if (!saveData()) return;

        updateDashboard();
        notify("Limite mensal atualizado! ✨");
    });
}

/* -------------------- METAS / PORQUINHOS -------------------- */

function setupGoalForm() {
    const form = $("#goalForm");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const name = $("#goalName")?.value.trim();
        const target = Number($("#goalTarget")?.value);
        const saved = Number($("#goalSaved")?.value || 0);
        const deadline = $("#goalDeadline")?.value || "";

        if (!name || !Number.isFinite(target) || target <= 0) {
            notify("Dá um nome pra meta e coloca um valor válido.");
            return;
        }

        if (!Number.isFinite(saved) || saved < 0 || saved > target) {
            notify("Confere o valor já guardado nessa meta.");
            return;
        }

        data.goals.push({
            id: uid(),
            name,
            target,
            saved,
            deadline,
            createdAt: new Date().toISOString()
        });

        if (!saveData()) return;

        form.reset();
        renderAll();
        notify("Nova meta criada. Bora conquistar! 💗");
    });
}

function renderGoals() {
    const container = $("#goalsList") ||
        $("#goalsGrid") ||
        $("#goalsContainer");

    if (!container) return;

    if (!data.goals.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎀</div>
                Nenhuma meta ainda. Cria uma pra começar teu próximo capítulo!
            </div>`;
        return;
    }

    container.innerHTML = data.goals.map(goal => {
        const target = Number(goal.target || 0);
        const saved = Number(goal.saved || 0);
        const percentage = target > 0
            ? Math.min((saved / target) * 100, 100)
            : 0;

        return `
            <article class="goal-card">
                <div class="goal-icon">🎀</div>
                <h3>${escapeHTML(goal.name)}</h3>
                <p>${goal.deadline ? `Prazo: ${formatDate(goal.deadline)}` : "No teu tempo, no teu ritmo."}</p>
                <div class="goal-values">
                    <strong>${money(saved)}</strong>
                    <span>de ${money(target)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${percentage}%"></div>
                </div>
                <div class="progress-meta">
                    <span>${Math.round(percentage)}% concluído</span>
                    <span>Faltam ${money(Math.max(0, target - saved))}</span>
                </div>
                <div class="form-actions">
                    <button class="btn btn-pink btn-sm"
                        data-add-goal="${escapeHTML(goal.id)}" type="button">
                        + Guardar dinheiro
                    </button>
                    <button class="btn btn-outline btn-sm"
                        data-delete-goal="${escapeHTML(goal.id)}" type="button">
                        Excluir
                    </button>
                </div>
            </article>`;
    }).join("");
}

function addToGoal(id) {
    const goal = data.goals.find(item => item.id === id);
    if (!goal) return;

    const remaining = Math.max(0, Number(goal.target) - Number(goal.saved));

    if (remaining <= 0) {
        notify("Essa meta já foi alcançada! ✨");
        return;
    }

    const answer = prompt(
        `Quanto deseja adicionar à meta "${goal.name}"?\nFaltam ${money(remaining)}.`
    );

    if (answer === null) return;

    const amount = Number(answer.replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) {
        notify("Coloca um valor válido.");
        return;
    }

    goal.saved = Math.min(Number(goal.target), Number(goal.saved) + amount);

    if (!saveData()) return;

    renderAll();
    notify(goal.saved >= goal.target
        ? "META CONQUISTADA! 💋✨"
        : "Dinheiro adicionado à meta!");
}

function deleteGoal(id) {
    const goal = data.goals.find(item => item.id === id);
    if (!goal) return;

    if (!confirm(`Excluir a meta "${goal.name}"?`)) return;

    data.goals = data.goals.filter(item => item.id !== id);

    saveData();
    renderAll();
    notify("Meta excluída.");
}

function renderDashboardGoals() {
    const container = $("#dashboardGoals");
    if (!container) return;

    const goals = data.goals.slice(0, 3);

    if (!goals.length) {
        container.innerHTML = `
            <div class="empty-state">
                Tu ainda não criou nenhuma meta. Bora planejar o próximo luxo? 💗
            </div>`;
        return;
    }

    container.innerHTML = goals.map(goal => {
        const target = Number(goal.target || 0);
        const saved = Number(goal.saved || 0);
        const percent = target ? Math.min(saved / target * 100, 100) : 0;

        return `
            <div style="margin-bottom:18px">
                <div class="legend-item">
                    <span>${escapeHTML(goal.name)}</span>
                    <strong>${Math.round(percent)}%</strong>
                </div>
                <div class="progress-bar" style="margin-top:10px">
                    <div class="progress-fill" style="width:${percent}%"></div>
                </div>
                <p style="font-size:10px;color:#858087;margin-top:7px">
                    ${money(saved)} de ${money(target)}
                </p>
            </div>`;
    }).join("");
}

/* -------------------- CARTÕES -------------------- */

function setupCardForm() {
    const form = $("#cardForm");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const name = $("#cardName")?.value.trim();
        const limit = Number($("#cardLimit")?.value);
        const closingDay = $("#cardClosingDay")?.value || "";
        const dueDay = $("#cardDueDay")?.value || "";

        if (!name || !Number.isFinite(limit) || limit <= 0) {
            notify("Confere o nome e o limite do cartão.");
            return;
        }

        data.cards.push({
            id: uid(),
            name,
            limit,
            closingDay,
            dueDay,
            createdAt: new Date().toISOString()
        });

        if (!saveData()) return;

        form.reset();
        renderAll();
        notify("Cartão adicionado! 💳");
    });
}

function getCardPurchases(cardId) {
    return data.purchases.filter(item => item.cardId === cardId);
}

function renderCards() {
    const container = $("#cardsList") ||
        $("#cardsGrid") ||
        $("#cardsContainer");

    if (!container) return;

    if (!data.cards.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💳</div>
                Nenhum cartão cadastrado. Adiciona um pra acompanhar os gastos.
            </div>`;
        return;
    }

    container.innerHTML = data.cards.map(card => {
        const purchases = getCardPurchases(card.id);
        const spent = purchases.reduce(
            (sum, item) => sum + Number(item.amount || 0), 0
        );
        const available = Number(card.limit) - spent;

        return `
            <article class="credit-card">
                <div class="card-brand">${escapeHTML(card.name)}</div>
                <div class="card-chip">▦</div>
                <div class="card-number">•••• &nbsp;•••• &nbsp;•••• &nbsp;${escapeHTML(card.lastFour || "0000")}</div>
                <div class="card-bottom">
                    <div>
                        <div class="card-holder">Limite disponível</div>
                        <div class="card-limit">${money(available)}</div>
                    </div>
                    <div style="text-align:right">
                        <div class="card-holder">Limite total</div>
                        <div>${money(card.limit)}</div>
                    </div>
                </div>
                <div class="card-caption">
                    ${card.closingDay ? `Fecha dia ${escapeHTML(card.closingDay)}` : ""}
                    ${card.dueDay ? ` • Vence dia ${escapeHTML(card.dueDay)}` : ""}
                </div>
                <div class="form-actions">
                    <button class="btn btn-pink btn-sm"
                        data-delete-card="${escapeHTML(card.id)}" type="button">
                        Excluir cartão
                    </button>
                </div>
            </article>`;
    }).join("");
}

function setupPurchaseForm() {
    const form = $("#purchaseForm");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const cardId = $("#purchaseCard")?.value;
        const description = $("#purchaseDescription")?.value.trim();
        const amount = Number($("#purchaseAmount")?.value);
        const date = $("#purchaseDate")?.value || today();

        const card = data.cards.find(item => item.id === cardId);

        if (!card || !description || !Number.isFinite(amount) || amount <= 0) {
            notify("Preenche os dados da compra direitinho.");
            return;
        }

        data.purchases.push({
            id: uid(),
            cardId,
            description,
            amount,
            date
        });

        if (!saveData()) return;

        form.reset();
        renderAll();
        notify("Compra registrada no cartão! 💳");
    });
}

function renderPurchaseCardOptions() {
    const select = $("#purchaseCard");
    if (!select) return;

    const selected = select.value;

    select.innerHTML = `
        <option value="">Selecione um cartão</option>
        ${data.cards.map(card => `
            <option value="${escapeHTML(card.id)}">
                ${escapeHTML(card.name)}
            </option>
        `).join("")}`;

    if (data.cards.some(card => card.id === selected)) {
        select.value = selected;
    }
}

function deleteCard(id) {
    const card = data.cards.find(item => item.id === id);
    if (!card) return;

    if (!confirm(`Excluir "${card.name}" e as compras registradas nele?`)) return;

    data.cards = data.cards.filter(item => item.id !== id);
    data.purchases = data.purchases.filter(item => item.cardId !== id);

    saveData();
    renderAll();
    notify("Cartão excluído.");
}

/* -------------------- PLANILHA -------------------- */

function renderSpreadsheet() {
    const body = $("#spreadsheetBody") ||
        $("#spreadsheetTable tbody");

    if (!body) return;

    const transactions = [...data.transactions]
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    if (!transactions.length) {
        body.innerHTML = `
            <tr><td colspan="5" class="empty-state">
                Tua planilha ainda tá vazia. Adiciona uma transação primeiro!
            </td></tr>`;
        return;
    }

    let runningBalance = 0;

    body.innerHTML = transactions.map(item => {
        const amount = Number(item.amount || 0);
        runningBalance += item.type === "income" ? amount : -amount;

        return `
            <tr>
                <td>${escapeHTML(formatDate(item.date))}</td>
                <td>${escapeHTML(item.description)}</td>
                <td>${escapeHTML(item.category)}</td>
                <td class="${item.type === "income" ? "amount-income" : "amount-expense"}">
                    ${item.type === "income" ? "+" : "−"}${money(amount)}
                </td>
                <td>${money(runningBalance)}</td>
            </tr>`;
    }).join("");

    setText("#spreadsheetTotalIncome",
        money(transactions.filter(t => t.type === "income")
            .reduce((s, t) => s + Number(t.amount), 0)));

    setText("#spreadsheetTotalExpenses",
        money(transactions.filter(t => t.type === "expense")
            .reduce((s, t) => s + Number(t.amount), 0)));

    setText("#spreadsheetFinalBalance", money(runningBalance));
}

/* -------------------- GRÁFICOS -------------------- */

function renderCharts(transactions = getMonthTransactions()) {
    if (typeof Chart === "undefined") return;

    const monthlyCanvas = $("#incomeExpenseChart");

    if (monthlyCanvas) {
        const income = transactions
            .filter(item => item.type === "income")
            .reduce((sum, item) => sum + Number(item.amount), 0);

        const expenses = transactions
            .filter(item => item.type === "expense")
            .reduce((sum, item) => sum + Number(item.amount), 0);

        if (incomeExpenseChart) incomeExpenseChart.destroy();

        incomeExpenseChart = new Chart(monthlyCanvas, {
            type: "bar",
            data: {
                labels: ["Entradas", "Despesas"],
                datasets: [{
                    data: [income, expenses],
                    backgroundColor: ["#b89a62", "#d7a4b7"],
                    borderRadius: 7,
                    maxBarThickness: 65
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => money(context.raw)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => money(value)
                        },
                        grid: { color: "#f0e9ec" }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    const categoryCanvas = $("#categoryChart");

    if (categoryCanvas) {
        const categoryTotals = {};

        transactions
            .filter(item => item.type === "expense")
            .forEach(item => {
                categoryTotals[item.category || "Outros"] =
                    (categoryTotals[item.category || "Outros"] || 0) +
                    Number(item.amount || 0);
            });

        const labels = Object.keys(categoryTotals);
        const values = Object.values(categoryTotals);

        if (categoryChart) categoryChart.destroy();

        categoryChart = new Chart(categoryCanvas, {
            type: "doughnut",
            data: {
                labels: labels.length ? labels : ["Sem despesas"],
                datasets: [{
                    data: values.length ? values : [1],
                    backgroundColor: [
                        "#d7a4b7",
                        "#b89a62",
                        "#292329",
                        "#e9c9d5",
                        "#a98c9a",
                        "#c7b7a0",
                        "#8f6b7b",
                        "#d8c4cb"
                    ],
                    borderWidth: 2,
                    borderColor: "#fffdfd"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => context.label === "Sem despesas"
                                ? context.label
                                : `${context.label}: ${money(context.raw)}`
                        }
                    }
                }
            }
        });

        const legend = $("#categoryLegend");

        if (legend) {
            const colors = [
                "#d7a4b7", "#b89a62", "#292329", "#e9c9d5",
                "#a98c9a", "#c7b7a0", "#8f6b7b", "#d8c4cb"
            ];

            legend.innerHTML = labels.length
                ? labels.map((label, index) => `
                    <div class="legend-item">
                        <span class="legend-label">
                            <span class="legend-dot"
                                style="background:${colors[index % colors.length]}"></span>
                            ${escapeHTML(label)}
                        </span>
                        <strong>${money(values[index])}</strong>
                    </div>
                `).join("")
                : `<p class="form-description">As categorias aparecem aqui quando houver despesas.</p>`;
        }
    }
}

/* -------------------- RELATÓRIOS -------------------- */

function renderReports() {
    const container = $("#reportsContent");
    if (!container) return;

    const transactions = getMonthTransactions();
    const totals = calculateTotals(transactions);

    const grouped = {};

    transactions.filter(item => item.type === "expense")
        .forEach(item => {
            const category = item.category || "Outros";
            grouped[category] = (grouped[category] || 0) + Number(item.amount);
        });

    const biggestCategory = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])[0];

    container.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card">
                <p class="stat-label">Entradas do mês</p>
                <h3>${money(totals.income)}</h3>
            </div>
            <div class="summary-card">
                <p class="stat-label">Despesas do mês</p>
                <h3>${money(totals.expenses)}</h3>
            </div>
            <div class="summary-card">
                <p class="stat-label">Saldo do mês</p>
                <h3>${money(totals.income - totals.expenses)}</h3>
            </div>
            <div class="summary-card">
                <p class="stat-label">Transações</p>
                <h3>${transactions.length}</h3>
            </div>
        </div>

        <div class="panel">
            <div class="panel-header">
                <h3>Spotted: teus gastos 👀</h3>
            </div>
            <p class="form-description">
                ${biggestCategory
                    ? `A categoria com mais despesas foi "${escapeHTML(biggestCategory[0])}", somando ${money(biggestCategory[1])}.`
                    : "Ainda não tem despesas registradas neste mês."}
            </p>
            <p class="form-description">
                ${totals.income - totals.expenses >= 0
                    ? "O saldo deste mês está positivo. Continua acompanhando as entradas e saídas!"
                    : "As despesas passaram das entradas neste mês. Vale revisar o orçamento com calma."}
            </p>
        </div>`;
}

/* -------------------- EXPORTAR DADOS -------------------- */

function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
    const blob = new Blob(["\uFEFF", content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

function exportJSON() {
    downloadFile(
        "gossip-girl-finance-backup.json",
        JSON.stringify(data, null, 2),
        "application/json;charset=utf-8"
    );

    notify("Backup preparado! Guarda esse arquivo em segurança.");
}

function exportCSV() {
    const rows = [
        ["Data", "Descrição", "Tipo", "Categoria", "Forma de pagamento", "Valor", "Observações"],
        ...data.transactions.map(item => [
            item.date,
            item.description,
            item.type === "income" ? "Entrada" : "Despesa",
            item.category,
            item.payment,
            item.amount,
            item.notes || ""
        ])
    ];

    const csv = rows.map(row =>
        row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")
    ).join("\r\n");

    downloadFile("gossip-girl-finance.csv", csv, "text/csv;charset=utf-8");
    notify("Planilha CSV exportada! 📊");
}

function importJSON(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
        try {
            const imported = JSON.parse(reader.result);

            if (
                !imported ||
                !Array.isArray(imported.transactions) ||
                !Array.isArray(imported.goals) ||
                !Array.isArray(imported.cards)
            ) {
                throw new Error("Arquivo incompatível.");
            }

            if (!confirm("Importar esse backup? Os dados atuais serão substituídos.")) {
                return;
            }

            data = {
                ...defaultData(),
                ...imported
            };

            if (!saveData()) return;

            renderAll();
            notify("Backup restaurado com sucesso!");
        } catch (error) {
            notify("Esse arquivo não parece ser um backup válido.");
        }
    };

    reader.readAsText(file);
}

/* -------------------- EVENTOS / EXTRAS -------------------- */

function setupExtraActions() {
    $("#exportJSON")?.addEventListener("click", exportJSON);
    $("#exportCSV")?.addEventListener("click", exportCSV);

    $("#clearData")?.addEventListener("click", () => {
        const confirmed = confirm(
            "Tem certeza que deseja apagar TODOS os dados salvos neste navegador? Essa ação não pode ser desfeita."
        );

        if (!confirmed) return;

        data = defaultData();
        saveData();
        renderAll();
        notify("Dados apagados.");
    });

    $("#importBackup")?.addEventListener("change", event => {
        importJSON(event.target.files?.[0]);
        event.target.value = "";
    });

    $("#dashboardMonth")?.addEventListener("change", updateDashboard);

    [
        "#transactionSearch",
        "#transactionFilterType",
        "#transactionFilterCategory",
        "#transactionFilterMonth"
    ].forEach(selector => {
        $(selector)?.addEventListener("input", renderTransactions);
        $(selector)?.addEventListener("change", renderTransactions);
    });

    document.addEventListener("click", event => {
        const deleteTransactionButton =
            event.target.closest("[data-delete-transaction]");

        if (deleteTransactionButton) {
            deleteTransaction(deleteTransactionButton.dataset.deleteTransaction);
            return;
        }

        const addGoalButton = event.target.closest("[data-add-goal]");

        if (addGoalButton) {
            addToGoal(addGoalButton.dataset.addGoal);
            return;
        }

        const deleteGoalButton = event.target.closest("[data-delete-goal]");

        if (deleteGoalButton) {
            deleteGoal(deleteGoalButton.dataset.deleteGoal);
            return;
        }

        const deleteCardButton = event.target.closest("[data-delete-card]");

        if (deleteCardButton) {
            deleteCard(deleteCardButton.dataset.deleteCard);
        }
    });
}

/* -------------------- RENDERIZAÇÃO GERAL -------------------- */

function renderAll() {
    updateDashboard();
    renderTransactions();
    renderSpreadsheet();
    renderGoals();
    renderCards();
    renderPurchaseCardOptions();
    renderReports();
}

/* -------------------- INICIALIZAÇÃO -------------------- */

function init() {
    setupNavigation();
    setupTransactionForm();
    setupBudgetForm();
    setupGoalForm();
    setupCardForm();
    setupPurchaseForm();
    setupExtraActions();

    const monthInput = $("#dashboardMonth");

    if (monthInput && !monthInput.value) {
        monthInput.value = today().slice(0, 7);
    }

    renderAll();

    const currentYear = $("#currentYear");
    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

    console.log("💋 Gossip Girl Finance carregado!");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
