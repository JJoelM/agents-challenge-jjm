// Estado local de la interfaz
let inventoryUnits = [];
let allReservations = [];

// Elementos del DOM
const inventoryGrid = document.getElementById('inventory-grid');
const inventoryCount = document.getElementById('inventory-count');
const availUnitSelect = document.getElementById('avail-unit');
const availStartInput = document.getElementById('avail-start');
const availEndInput = document.getElementById('avail-end');
const formAvailability = document.getElementById('form-availability');
const availFeedback = document.getElementById('availability-feedback');
const btnCopyToReserve = document.getElementById('btn-copy-to-reserve');

const resUnitSelect = document.getElementById('res-unit');
const resRequesterInput = document.getElementById('res-requester');
const resStartInput = document.getElementById('res-start');
const resEndInput = document.getElementById('res-end');
const formReservation = document.getElementById('form-reservation');
const resFeedback = document.getElementById('reservation-feedback');

const filterUnitSelect = document.getElementById('filter-unit');
const filterStatusSelect = document.getElementById('filter-status');
const reservationsTbody = document.getElementById('reservations-tbody');
const tableFeedback = document.getElementById('table-feedback');

const btnRefresh = document.getElementById('btn-refresh');
const btnResetDb = document.getElementById('btn-reset-db');

function getDefaultBaseDate() {
  return '2026-10-27';
}

function setInitialDefaultDates() {
  const baseDate = getDefaultBaseDate();
  availStartInput.value = `${baseDate}T10:00`;
  availEndInput.value = `${baseDate}T11:00`;
  resStartInput.value = `${baseDate}T10:00`;
  resEndInput.value = `${baseDate}T11:00`;
}

function showFeedback(element, type, htmlContent) {
  element.className = `feedback-box feedback-${type}`;
  element.innerHTML = htmlContent;
}

function hideFeedback(element) {
  element.className = 'feedback-box hidden';
  element.innerHTML = '';
}

function formatDateTimeDisplay(isoString) {
  if (!isoString) return '-';
  return isoString.replace('T', ' ');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function fetchInventory() {
  const res = await fetch('/api/inventory');
  const data = await res.json();
  inventoryUnits = data.units || [];
  inventoryCount.textContent = `${inventoryUnits.length} unidades`;
  renderInventorySelectors();
  renderInventoryCards();
}

function renderInventorySelectors() {
  const optionsHtml = inventoryUnits
    .map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.id)} — ${escapeHtml(u.name)}</option>`)
    .join('');

  availUnitSelect.innerHTML = optionsHtml;
  resUnitSelect.innerHTML = optionsHtml;

  const currentFilter = filterUnitSelect.value;
  filterUnitSelect.innerHTML =
    `<option value="">Todas las unidades</option>` +
    inventoryUnits
      .map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.id)} (${escapeHtml(u.name)})</option>`)
      .join('');
  filterUnitSelect.value = currentFilter;
}

function renderInventoryCards() {
  const activeCountByUnit = {};
  for (const r of allReservations) {
    if (r.status === 'ACTIVE') {
      activeCountByUnit[r.unitId] = (activeCountByUnit[r.unitId] || 0) + 1;
    }
  }

  inventoryGrid.innerHTML = inventoryUnits
    .map((u) => {
      const count = activeCountByUnit[u.id] || 0;
      const badgeText = count === 1 ? '1 reserva activa' : `${count} reservas activas`;
      return `
        <div class="unit-card" role="listitem" tabindex="0" data-unit-id="${escapeHtml(u.id)}">
          <div class="unit-card-header">
            <span class="unit-code">${escapeHtml(u.id)}</span>
            <span class="unit-active-badge">${badgeText}</span>
          </div>
          <div class="unit-name">${escapeHtml(u.name)}</div>
          <div class="unit-desc">${escapeHtml(u.description)}</div>
        </div>
      `;
    })
    .join('');

  document.querySelectorAll('.unit-card').forEach((card) => {
    card.addEventListener('click', () => {
      const unitId = card.getAttribute('data-unit-id');
      if (unitId) {
        availUnitSelect.value = unitId;
        resUnitSelect.value = unitId;
      }
    });
  });
}

async function fetchReservations() {
  const params = new URLSearchParams();
  if (filterUnitSelect.value) {
    params.set('unitId', filterUnitSelect.value);
  }
  if (filterStatusSelect.value) {
    params.set('status', filterStatusSelect.value);
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`/api/reservations${query}`);
  const data = await res.json();
  const filteredReservations = data.reservations || [];

  // También actualizamos el conteo global si no hay filtros
  if (!filterUnitSelect.value && !filterStatusSelect.value) {
    allReservations = filteredReservations;
  } else {
    const allRes = await fetch('/api/reservations');
    const allData = await allRes.json();
    allReservations = allData.reservations || [];
  }

  renderInventoryCards();
  renderReservationsTable(filteredReservations);
}

function renderReservationsTable(reservations) {
  if (reservations.length === 0) {
    reservationsTbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">No se encontraron reservas registradas con los filtros actuales.</td>
      </tr>
    `;
    return;
  }

  reservationsTbody.innerHTML = reservations
    .map((r) => {
      const isActive = r.status === 'ACTIVE';
      const statusBadge = isActive
        ? `<span class="status-badge status-active">ACTIVA</span>`
        : `<span class="status-badge status-cancelled">CANCELADA</span>`;

      const actionCell = isActive
        ? `<button type="button" class="btn-cancel-row" data-cancel-id="${escapeHtml(r.id)}">Cancelar</button>`
        : `<span style="font-size: 0.78rem; color: #94a3b8;">Liberada</span>`;

      return `
        <tr class="${isActive ? '' : 'row-cancelled'}">
          <td><span class="id-badge">${escapeHtml(r.id)}</span></td>
          <td><code>${escapeHtml(r.unitId)}</code></td>
          <td><strong>${escapeHtml(r.requester)}</strong></td>
          <td>${escapeHtml(formatDateTimeDisplay(r.startTime))}</td>
          <td>${escapeHtml(formatDateTimeDisplay(r.endTime))}</td>
          <td>${statusBadge}</td>
          <td class="col-actions">${actionCell}</td>
        </tr>
      `;
    })
    .join('');

  document.querySelectorAll('[data-cancel-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-cancel-id');
      if (id) {
        await handleCancelReservation(id);
      }
    });
  });
}

async function handleCancelReservation(reservationId) {
  hideFeedback(tableFeedback);
  try {
    const res = await fetch(`/api/reservations/${encodeURIComponent(reservationId)}/cancel`, {
      method: 'POST',
    });
    const data = await res.json();

    if (!res.ok) {
      showFeedback(
        tableFeedback,
        'error',
        `<strong>Error al cancelar:</strong> ${escapeHtml(data.error || 'No se pudo cancelar la reserva.')}`
      );
      return;
    }

    const cancelled = data.reservation;
    showFeedback(
      tableFeedback,
      'success',
      `<strong>Reserva ${escapeHtml(cancelled.id)} cancelada:</strong> El equipo <code>${escapeHtml(
        cancelled.unitId
      )}</code> quedó liberado en el horario ${escapeHtml(
        formatDateTimeDisplay(cancelled.startTime)
      )} a ${escapeHtml(formatDateTimeDisplay(cancelled.endTime))} y el registro permanece en el historial.`
    );

    await fetchReservations();
  } catch (err) {
    showFeedback(tableFeedback, 'error', `Error de red al cancelar la reserva: ${escapeHtml(err.message)}`);
  }
}

formAvailability.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideFeedback(availFeedback);

  const unitId = availUnitSelect.value;
  const start = availStartInput.value;
  const end = availEndInput.value;

  const params = new URLSearchParams({ unitId, start, end });
  try {
    const res = await fetch(`/api/availability?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      showFeedback(
        availFeedback,
        'error',
        `<strong>Validación:</strong> ${escapeHtml(data.error || 'Parámetros inválidos.')}`
      );
      return;
    }

    if (data.available) {
      showFeedback(
        availFeedback,
        'success',
        `<strong>DISPONIBLE:</strong> La unidad <code>${escapeHtml(
          data.unitId
        )}</code> se encuentra libre entre <strong>${escapeHtml(
          formatDateTimeDisplay(data.startTime)
        )}</strong> y <strong>${escapeHtml(formatDateTimeDisplay(data.endTime))}</strong>.`
      );
    } else {
      const conflict = data.conflictingReservation;
      const conflictDetails = conflict
        ? `Colisiona con la reserva activa <strong>${escapeHtml(conflict.id)}</strong> de <em>${escapeHtml(
            conflict.requester
          )}</em> (${escapeHtml(formatDateTimeDisplay(conflict.startTime))} a ${escapeHtml(
            formatDateTimeDisplay(conflict.endTime)
          )}).`
        : escapeHtml(data.reason || 'Horario ocupado.');

      showFeedback(
        availFeedback,
        'warning',
        `<strong>OCUPADO (NO DISPONIBLE):</strong> ${conflictDetails}`
      );
    }
  } catch (err) {
    showFeedback(availFeedback, 'error', `Error de conexión: ${escapeHtml(err.message)}`);
  }
});

btnCopyToReserve.addEventListener('click', () => {
  resUnitSelect.value = availUnitSelect.value;
  resStartInput.value = availStartInput.value;
  resEndInput.value = availEndInput.value;
  resRequesterInput.focus();
});

formReservation.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideFeedback(resFeedback);

  const payload = {
    unitId: resUnitSelect.value,
    requester: resRequesterInput.value,
    startTime: resStartInput.value,
    endTime: resEndInput.value,
  };

  try {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      const prefix = res.status === 409 ? 'Conflicto de Horario (409)' : 'Datos Inválidos (400)';
      showFeedback(
        resFeedback,
        'error',
        `<strong>${prefix}:</strong> ${escapeHtml(data.error || 'No fue posible registrar la reserva.')}`
      );
      return;
    }

    const created = data.reservation;
    showFeedback(
      resFeedback,
      'success',
      `<strong>Reserva Confirmada (${escapeHtml(created.id)}):</strong> Asignada la unidad <code>${escapeHtml(
        created.unitId
      )}</code> a <strong>${escapeHtml(created.requester)}</strong> de ${escapeHtml(
        formatDateTimeDisplay(created.startTime)
      )} a ${escapeHtml(formatDateTimeDisplay(created.endTime))}.`
    );

    await fetchReservations();
  } catch (err) {
    showFeedback(resFeedback, 'error', `Error de red al crear reserva: ${escapeHtml(err.message)}`);
  }
});

// Botones de autocompletado rápido para demostración ágil
document.querySelectorAll('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const preset = btn.getAttribute('data-preset');
    const baseDate = getDefaultBaseDate();
    hideFeedback(resFeedback);

    if (preset === '1') {
      resUnitSelect.value = 'MIC-01';
      resRequesterInput.value = 'Dra. García';
      resStartInput.value = `${baseDate}T10:00`;
      resEndInput.value = `${baseDate}T11:00`;
    } else if (preset === '2') {
      resUnitSelect.value = 'MIC-01';
      resRequesterInput.value = 'Ing. Pérez';
      resStartInput.value = `${baseDate}T11:00`;
      resEndInput.value = `${baseDate}T12:00`;
    } else if (preset === '3') {
      resUnitSelect.value = 'MIC-01';
      resRequesterInput.value = 'Dr. López';
      resStartInput.value = `${baseDate}T10:30`;
      resEndInput.value = `${baseDate}T11:30`;
    }
  });
});

filterUnitSelect.addEventListener('change', () => fetchReservations());
filterStatusSelect.addEventListener('change', () => fetchReservations());

btnRefresh.addEventListener('click', async () => {
  hideFeedback(tableFeedback);
  await fetchReservations();
});

btnResetDb.addEventListener('click', async () => {
  const res = await fetch('/api/admin/reset', { method: 'POST' });
  const data = await res.json();
  hideFeedback(availFeedback);
  hideFeedback(resFeedback);
  showFeedback(tableFeedback, 'warning', `<strong>Sistema Reiniciado:</strong> ${escapeHtml(data.message)}`);
  await fetchReservations();
});

// Inicialización al cargar la página
async function initDashboard() {
  setInitialDefaultDates();
  await fetchInventory();
  await fetchReservations();
}

initDashboard();
