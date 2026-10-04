<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Stora Lundby - Admin</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 24px;
        background: #f7f7f7;
      }
      .wrap {
        max-width: 1200px;
        margin: 0 auto;
      }
      .panel {
        background: #fff;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 1px 8px rgba(0,0,0,0.08);
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }
      .card {
        background: #f2f5ff;
        border-radius: 10px;
        padding: 16px;
      }
      .card strong {
        display: block;
        font-size: 30px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 10px 8px;
        border-bottom: 1px solid #e2e2e2;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f1f1f1;
      }
      select, input, button {
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #cfcfcf;
        font-size: 14px;
      }
      button {
        background: #1a73e8;
        color: #fff;
        border: none;
        cursor: pointer;
      }
      .small {
        font-size: 12px;
        color: #555;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px,1fr));
        gap: 16px;
      }
      label {
        display: block;
        margin-top: 12px;
        margin-bottom: 6px;
        font-weight: 600;
      }
      .status-select {
        min-width: 120px;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Stora Lundby - Admin</h1>

      <div class="panel">
        <h2>Översikt</h2>
        <div class="summary">
          <div class="card"><span>Totalt</span><strong id="totalCount">0</strong></div>
          <div class="card"><span>Nya</span><strong id="newCount">0</strong></div>
          <div class="card"><span>Volontärer</span><strong id="volunteerCount">0</strong></div>
          <div class="card"><span>Hjälp</span><strong id="helpCount">0</strong></div>
        </div>
      </div>

      <div class="panel">
        <h2>Lägg till manuell anmälan</h2>
        <div class="grid">
          <div>
            <label for="manualName">Namn</label>
            <input id="manualName" type="text">
          </div>
          <div>
            <label for="manualEmail">E-post</label>
            <input id="manualEmail" type="email">
          </div>
          <div>
            <label for="manualPhone">Telefon</label>
            <input id="manualPhone" type="tel">
          </div>
          <div>
            <label for="manualType">Typ</label>
            <select id="manualType">
              <option value="need-help">Behov av hjälp</option>
              <option value="volunteer">Volontär</option>
              <option value="organizer">Ansvarig</option>
            </select>
          </div>
          <div>
            <label for="manualYear">År</label>
            <input id="manualYear" type="text" value="2026">
          </div>
          <div>
            <label for="manualTerm">Termin</label>
            <input id="manualTerm" type="text" value="Höst">
          </div>
        </div>
        <div style="margin-top:16px;">
          <button id="addManualBtn">Skapa anmälan</button>
        </div>
      </div>

      <div class="panel">
        <h2>Anmälningar</h2>
        <table>
          <thead>
            <tr>
              <th>Namn</th>
              <th>Typ</th>
              <th>År/Termin</th>
              <th>Telefon</th>
              <th>E-post</th>
              <th>Status</th>
              <th>Samtycke</th>
            </tr>
          </thead>
          <tbody id="applicationRows"></tbody>
        </table>
      </div>
    </div>

    <script>
      function renderSummary(summary) {
        document.getElementById('totalCount').textContent = summary.total || 0;
        document.getElementById('newCount').textContent = summary.newCount || 0;
        document.getElementById('volunteerCount').textContent = summary.volunteerCount || 0;
        document.getElementById('helpCount').textContent = summary.helpCount || 0;
      }

      function renderRows(rows) {
        const tableBody = document.getElementById('applicationRows');
        tableBody.innerHTML = '';

        rows.forEach(function (item) {
          const tr = document.createElement('tr');
          const statusList = ['Ny', 'Behandlas', 'Godkänd', 'Avslutad'];
          const statusSelect = document.createElement('select');
          statusList.forEach(function (status) {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            if (String(item.status || 'Ny') === status) option.selected = true;
            statusSelect.appendChild(option);
          });

          statusSelect.className = 'status-select';
          statusSelect.addEventListener('change', function () {
            google.script.run.withSuccessHandler(function () {
              loadData();
            }).updateApplicationStatus(item.id, statusSelect.value);
          });

          tr.innerHTML = '<td>' + (item.name || '') + '</td>'
            + '<td>' + (item.engagementType || '') + '</td>'
            + '<td>' + (item.year || '') + ' / ' + (item.term || '') + '</td>'
            + '<td>' + (item.phone || '') + '</td>'
            + '<td>' + (item.email || '') + '</td>';

          const statusCell = document.createElement('td');
          statusCell.appendChild(statusSelect);
          tr.appendChild(statusCell);

          const consentCell = document.createElement('td');
          consentCell.textContent = String(item.consentGiven || '').toUpperCase() === 'TRUE' ? 'Ja' : 'Nej';
          tr.appendChild(consentCell);

          tableBody.appendChild(tr);
        });
      }

      function loadData() {
        google.script.run.withSuccessHandler(function (data) {
          renderSummary(data.summary || { total: 0, newCount: 0, volunteerCount: 0, helpCount: 0 });
          renderRows(data.rows || []);
        }).getAdminDashboard();
      }

      document.getElementById('addManualBtn').addEventListener('click', function () {
        const payload = {
          name: document.getElementById('manualName').value,
          email: document.getElementById('manualEmail').value,
          phone: document.getElementById('manualPhone').value,
          engagementType: document.getElementById('manualType').value,
          year: document.getElementById('manualYear').value,
          term: document.getElementById('manualTerm').value,
          status: 'Ny',
          consent: true
        };

        google.script.run.withSuccessHandler(function () {
          loadData();
          document.getElementById('manualName').value = '';
          document.getElementById('manualEmail').value = '';
          document.getElementById('manualPhone').value = '';
        }).createManualApplication(payload);
      });

      loadData();
    </script>
  </body>
</html>
