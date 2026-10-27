// Estado local del Dashboard
let inventoryUnits = [];
let allReservations = [];
let selectedUnitId = 'MIC-01';
let pendingDialogAction = null;

// Referencias a KPIs
const kpiTotalUnits = document.getElementById('kpi-total-units');
const kpiActiveCount = document.getElementById('kpi-active-count');
const kpiCancelledCount = document.getElementById('kpi-cancelled-count');
const kpiSelectedUnit = document.getElementById('kpi-selected-unit');
const kpiSelectedName = document.getElementById('kpi-selected-name');
const tabBadgeTotal = document.getElementById('tab-badge-total');
const globalToast = document.getElementById('global-toast');

// Referencias a Pestañas (Tabs)
const tabButtons = Array.from(document.querySelectorAll('[role="tab"]'));
const tabPanels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

// Referencias de Catálogo y Disponibilidad (Pestaña 1)
const inventoryGrid = document.getElementById('inventory-grid');
const inventoryCount = document.getElementById('inventory-count');
const availUnitSelect = document.getElementById('avail-unit');
const availStartInput = document.getElementById('avail-start');
const availEndInput = document.getElementById('avail-end');
const formAvailability = document.getElementById('form-availability');
const availFeedback = document.getElementById('availability-feedback');
const btnCopyToReserve = document.getElementById('btn-copy-to-reserve');

// Referencias de Nueva Reserva (Pestaña 2)
const resUnitSelect = document.getElementById('res-unit');
const resRequesterInput = document.getElementById('res-requester');
const resStartInput = document.getElementById('res-start');
const resEndInput = document.getElementById('res-end');
const durationIndicator = document.getElementById('duration-indicator');
const formReservation = document.getElementById('form-reservation');
const resFeedback = document.getElementById('reservation-feedback');
const btnCheckFromCreate = document.getElementById('btn-check-from-create');

// Referencias de Historial (Pestaña 3)
const filterUnitSelect = document.getElementById('filter-unit');
const filterStatusSelect = document.getElementById('filter-status');
const reservationsTbody = document.getElementById('reservations-tbody');
const tableFeedback = document.getElementById('table-feedback');
const btnGoNewFromHistory = document.getElementById('btn-go-new-from-history');

// Acciones de Header y Diálogo Modal Nativo
const btnRefresh = document.getElementById('btn-refresh');
const btnResetDb = document.getElementById('btn-reset-db');
const confirmDialog = document.getElementById('confirm-dialog');
const dialogTitle = document.getElementById('dialog-title');
const dialogDescription = document.getElementById('dialog-description');
const dialogConfirmBtn = document.getElementById('dialog-confirm-btn');

function getDefaultBaseDate() {
  return '2026-10-27';
}

function setInitialDefaultDates() {
  const baseDate = getDefaultBaseDate();
  availStartInput.value = `${baseDate}T10:00`;
  availEndInput.value = `${baseDate}T11:00`;
  resStartInput.value = `${baseDate}T10:00`;
  resEndInput.value = `${baseDate}T11:00`;
  updateDurationBadge();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateTimeDisplay(isoString) {
  if (!isoString) return '-';
  return isoString.replace('T', ' ');
}

function showFeedback(element, type, htmlContent) {
  element.className = `feedback-box feedback-${type}`;
  element.innerHTML = htmlContent;
}

function hideFeedback(element) {
  element.className = 'feedback-box hidden';
  element.innerHTML = '';
}

// =========================================================
// Sistema de Pestañas (Tabs con ARIA + Teclado)
// =========================================================
function switchTab(targetPanelId, focusTab = false) {
  tabButtons.forEach((btn) => {
    const isTarget = btn.getAttribute('data-tab-target') === targetPanelId;
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    btn.setAttribute('tabindex', isTarget ? '0' : '-1');
    const parentLi = btn.closest('.tab-item');
    if (parentLi) {
      parentLi.classList.toggle('active', isTarget);
    }
    if (isTarget && focusTab) {
      btn.focus();
    }
  });

  tabPanels.forEach((panel) => {
    if (panel.id === targetPanelId) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  });
}

tabButtons.forEach((btn, index) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-tab-target');
    if (targetId) {
      switchTab(targetId, false);
    }
  });

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + delta + tabButtons.length) % tabButtons.length;
      const nextBtn = tabButtons[nextIndex];
      const targetId = nextBtn.getAttribute('data-tab-target');
      if (targetId) {
        switchTab(targetId, true);
      }
    }
  });
});

// =========================================================
// Sincronización de Unidad Seleccionada y KPIs
// =========================================================
function selectUnit(unitId) {
  selectedUnitId = unitId;
  availUnitSelect.value = unitId;
  resUnitSelect.value = unitId;

  const unitObj = inventoryUnits.find((u) => u.id === unitId);
  kpiSelectedUnit.textContent = unitId;
  kpiSelectedName.textContent = unitObj ? unitObj.name : 'Unidad de laboratorio';

  document.querySelectorAll('.unit-card').forEach((card) => {
    card.classList.toggle('unit-selected', card.getAttribute('data-unit-id') === unitId);
  });
}

function updateKpiCounters() {
  const activeCount = allReservations.filter((r) => r.status === 'ACTIVE').length;
  const cancelledCount = allReservations.filter((r) => r.status === 'CANCELLED').length;

  kpiTotalUnits.textContent = `${inventoryUnits.length} Equipos Físicos`;
  kpiActiveCount.textContent = String(activeCount);
  kpiCancelledCount.textContent = String(cancelledCount);
  tabBadgeTotal.textContent = String(allReservations.length);
}

function updateDurationBadge() {
  const start = new Date(resStartInput.value);
  const end = new Date(resEndInput.value);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    durationIndicator.textContent = 'Duración: Seleccione fechas';
    return;
  }
  const diffMin = Math.round((end.getTime() - start.getTime()) / 60000);
  if (diffMin <= 0) {
    durationIndicator.textContent = 'Duración inválida (Inicio >= Fin)';
    return;
  }
  const hours = (diffMin / 60).toFixed(1);
  durationIndicator.textContent = `Duración: ${diffMin} min (${hours} h)`;
}

resStartInput.addEventListener('change', updateDurationBadge);
resEndInput.addEventListener('change', updateDurationBadge);
availUnitSelect.addEventListener('change', () => selectUnit(availUnitSelect.value));
resUnitSelect.addEventListener('change', () => selectUnit(resUnitSelect.value));

// =========================================================
// Carga de Inventario y Catálogo Visual
// =========================================================
async function fetchInventory() {
  const res = await fetch('/api/inventory');
  const data = await res.json();
  inventoryUnits = data.units || [];
  inventoryCount.textContent = `${inventoryUnits.length} unidades`;
  renderInventorySelectors();
  selectUnit(selectedUnitId);
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
      const badgeClass = count === 0 ? 'unit-badge-free' : 'unit-badge-busy';
      const badgeText = count === 0 ? 'Sin turnos activos' : count === 1 ? '1 reserva activa' : `${count} reservas activas`;
      const isSelected = u.id === selectedUnitId ? 'unit-selected' : '';

      return `
        <div class="unit-card ${isSelected}" role="listitem" data-unit-id="${escapeHtml(u.id)}">
          <div>
            <div class="unit-card-header">
              <span class="unit-code">${escapeHtml(u.id)}</span>
              <span class="unit-active-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="unit-name">${escapeHtml(u.name)}</div>
            <div class="unit-desc">${escapeHtml(u.description)}</div>
          </div>
          <div class="unit-card-actions">
            <button type="button" class="btn btn-secondary btn-xs" data-action-check="${escapeHtml(u.id)}">
              Consultar horario
            </button>
            <button type="button" class="btn btn-primary btn-xs" data-action-book="${escapeHtml(u.id)}">
              Reservar equipo →
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  document.querySelectorAll('[data-action-check]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const unitId = btn.getAttribute('data-action-check');
      if (unitId) {
        selectUnit(unitId);
        availStartInput.focus();
      }
    });
  });

  document.querySelectorAll('[data-action-book]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const unitId = btn.getAttribute('data-action-book');
      if (unitId) {
        selectUnit(unitId);
        switchTab('panel-create', false);
        resRequesterInput.focus();
      }
    });
  });
}

// =========================================================
// Consulta de Disponibilidad
// =========================================================
async function runAvailabilityCheck(unitId, start, end, targetFeedbackEl) {
  hideFeedback(targetFeedbackEl);
  const params = new URLSearchParams({ unitId, start, end });

  try {
    const res = await fetch(`/api/availability?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      showFeedback(
        targetFeedbackEl,
        'error',
        `<span><strong>Validación:</strong> ${escapeHtml(data.error || 'Parámetros inválidos.')}</span>`
      );
      return;
    }

    if (data.available) {
      showFeedback(
        targetFeedbackEl,
        'success',
        `
          <span>
            <strong>DISPONIBLE:</strong> La unidad <code>${escapeHtml(data.unitId)}</code> está libre entre
            <strong>${escapeHtml(formatDateTimeDisplay(data.startTime))}</strong> y
            <strong>${escapeHtml(formatDateTimeDisplay(data.endTime))}</strong>.
          </span>
          <button type="button" class="btn btn-success btn-xs" id="btn-quick-jump-reserve">
            Reservar este turno →
          </button>
        `
      );

      const jumpBtn = document.getElementById('btn-quick-jump-reserve');
      if (jumpBtn) {
        jumpBtn.addEventListener('click', () => {
          selectUnit(data.unitId);
          resStartInput.value = data.startTime;
          resEndInput.value = data.endTime;
          updateDurationBadge();
          switchTab('panel-create', false);
          resRequesterInput.focus();
        });
      }
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
        targetFeedbackEl,
        'warning',
        `<span><strong>OCUPADO (NO DISPONIBLE):</strong> ${conflictDetails}</span>`
      );
    }
  } catch (err) {
    showFeedback(targetFeedbackEl, 'error', `<span>Error de conexión: ${escapeHtml(err.message)}</span>`);
  }
}

formAvailability.addEventListener('submit', async (e) => {
  e.preventDefault();
  await runAvailabilityCheck(availUnitSelect.value, availStartInput.value, availEndInput.value, availFeedback);
});

btnCopyToReserve.addEventListener('click', () => {
  selectUnit(availUnitSelect.value);
  resStartInput.value = availStartInput.value;
  resEndInput.value = availEndInput.value;
  updateDurationBadge();
  switchTab('panel-create', false);
  resRequesterInput.focus();
});

btnCheckFromCreate.addEventListener('click', async () => {
  await runAvailabilityCheck(resUnitSelect.value, resStartInput.value, resEndInput.value, resFeedback);
});

// =========================================================
// Creación de Nueva Reserva (Pestaña 2)
// =========================================================
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
        `<span><strong>${prefix}:</strong> ${escapeHtml(data.error || 'No fue posible registrar la reserva.')}</span>`
      );
      return;
    }

    const created = data.reservation;
    showFeedback(
      resFeedback,
      'success',
      `
        <span>
          <strong>Reserva Confirmada (${escapeHtml(created.id)}):</strong> Unidad
          <code>${escapeHtml(created.unitId)}</code> asignada a <strong>${escapeHtml(created.requester)}</strong>
          (${escapeHtml(formatDateTimeDisplay(created.startTime))} a ${escapeHtml(formatDateTimeDisplay(created.endTime))}).
        </span>
        <button type="button" class="btn btn-secondary btn-xs" id="btn-view-in-history">
          Ver en Historial →
        </button>
      `
    );

    const viewHistoryBtn = document.getElementById('btn-view-in-history');
    if (viewHistoryBtn) {
      viewHistoryBtn.addEventListener('click', () => {
        switchTab('panel-history', false);
      });
    }

    await fetchReservations();
  } catch (err) {
    showFeedback(resFeedback, 'error', `<span>Error de red al crear reserva: ${escapeHtml(err.message)}</span>`);
  }
});

// Escenarios rápidos de prueba
document.querySelectorAll('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const preset = btn.getAttribute('data-preset');
    const baseDate = getDefaultBaseDate();
    hideFeedback(resFeedback);

    if (preset === '1') {
      selectUnit('MIC-01');
      resRequesterInput.value = 'Dra. García';
      resStartInput.value = `${baseDate}T10:00`;
      resEndInput.value = `${baseDate}T11:00`;
    } else if (preset === '2') {
      selectUnit('MIC-01');
      resRequesterInput.value = 'Ing. Pérez';
      resStartInput.value = `${baseDate}T11:00`;
      resEndInput.value = `${baseDate}T12:00`;
    } else if (preset === '3') {
      selectUnit('MIC-01');
      resRequesterInput.value = 'Dr. López';
      resStartInput.value = `${baseDate}T10:30`;
      resEndInput.value = `${baseDate}T11:30`;
    } else if (preset === '4') {
      selectUnit('MIC-02');
      resRequesterInput.value = 'Lic. Torres';
      resStartInput.value = `${baseDate}T10:00`;
      resEndInput.value = `${baseDate}T11:00`;
    }
    updateDurationBadge();
  });
});

// =========================================================
// Historial, Filtros y Cancelación con <dialog> (Pestaña 3)
// =========================================================
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

  if (!filterUnitSelect.value && !filterStatusSelect.value) {
    allReservations = filteredReservations;
  } else {
    const allRes = await fetch('/api/reservations');
    const allData = await allRes.json();
    allReservations = allData.reservations || [];
  }

  updateKpiCounters();
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
        : `<span style="font-size: 0.78rem; color: #94a3b8;">Horario liberado</span>`;

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
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cancel-id');
      if (id) {
        openConfirmModal({
          title: `¿Cancelar la reserva ${id}?`,
          description: `La reserva ${id} pasará a estado CANCELADA. El intervalo horario quedará inmediatamente libre para otros investigadores, manteniendo el registro en el historial.`,
          confirmText: 'Sí, cancelar reserva',
          onConfirm: () => executeCancelReservation(id),
        });
      }
    });
  });
}

async function executeCancelReservation(reservationId) {
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
        `<span><strong>Error al cancelar:</strong> ${escapeHtml(data.error || 'No se pudo cancelar la reserva.')}</span>`
      );
      return;
    }

    const cancelled = data.reservation;
    showFeedback(
      tableFeedback,
      'success',
      `<span><strong>Reserva ${escapeHtml(cancelled.id)} cancelada:</strong> El equipo <code>${escapeHtml(
        cancelled.unitId
      )}</code> quedó liberado en el horario ${escapeHtml(
        formatDateTimeDisplay(cancelled.startTime)
      )} a ${escapeHtml(formatDateTimeDisplay(cancelled.endTime))}.</span>`
    );

    await fetchReservations();
  } catch (err) {
    showFeedback(tableFeedback, 'error', `<span>Error de red al cancelar: ${escapeHtml(err.message)}</span>`);
  }
}

// =========================================================
// Modal de Confirmación Nativo (<dialog>)
// =========================================================
function openConfirmModal({ title, description, confirmText, onConfirm }) {
  dialogTitle.textContent = title;
  dialogDescription.textContent = description;
  dialogConfirmBtn.textContent = confirmText;
  pendingDialogAction = onConfirm;

  if (typeof confirmDialog.showModal === 'function') {
    confirmDialog.showModal();
  } else {
    // Fallback en entornos sin soporte de HTMLDialogElement
    onConfirm();
  }
}

confirmDialog.addEventListener('close', async () => {
  if (confirmDialog.returnValue === 'confirm' && typeof pendingDialogAction === 'function') {
    const action = pendingDialogAction;
    pendingDialogAction = null;
    await action();
  } else {
    pendingDialogAction = null;
  }
});

filterUnitSelect.addEventListener('change', () => fetchReservations());
filterStatusSelect.addEventListener('change', () => fetchReservations());

btnGoNewFromHistory.addEventListener('click', () => {
  switchTab('panel-create', false);
  resRequesterInput.focus();
});

btnRefresh.addEventListener('click', async () => {
  hideFeedback(globalToast);
  await fetchReservations();
});

btnResetDb.addEventListener('click', () => {
  openConfirmModal({
    title: '¿Reiniciar la base de datos SQLite?',
    description:
      'Se eliminarán todas las reservas activas y canceladas registradas hasta el momento, dejando el sistema en su estado inicial limpio.',
    confirmText: 'Sí, reiniciar base de datos',
    onConfirm: async () => {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      const data = await res.json();
      hideFeedback(availFeedback);
      hideFeedback(resFeedback);
      hideFeedback(tableFeedback);
      showFeedback(
        globalToast,
        'warning',
        `<span><strong>Base de Datos Reiniciada:</strong> ${escapeHtml(data.message)}</span>`
      );
      await fetchReservations();
    },
  });
});

// Inicialización
async function initDashboard() {
  setInitialDefaultDates();
  await fetchInventory();
  await fetchReservations();
}

initDashboard();
