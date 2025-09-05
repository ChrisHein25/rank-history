// ---------- Utilities ----------
async function fetchJSONSafe(url) {
  const res = await fetch(url);
  try {
    return await res.json();
  } catch {
    const buf = await res.arrayBuffer();
    const tryDecode = enc => {
      try {
        const txt = new TextDecoder(enc).decode(buf).replace(/^\uFEFF/, '');
        return JSON.parse(txt);
      } catch { return null; }
    };
    return tryDecode('utf-8') ?? tryDecode('utf-16le') ?? (() => { throw new Error(`Cannot parse ${url}`); })();
  }
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort((a, b) => (a > b ? 1 : -1));
}

function stableColorFor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return `hsl(${h},70%,45%)`;
}

// ---------- Data Layer ----------
class DataStore {
  constructor() {
    this.rankings = [];
    this.overrated = [];
    this.overratedStats = [];
  }

  async load() {
    const [rankings, overrated, overratedStats] = await Promise.all([
      fetchJSONSafe('./data/rankings.json'),
      fetchJSONSafe('./data/overrated.json'),
      fetchJSONSafe('./data/overrated_stats.json'),
    ]);
    this.rankings = rankings;
    this.overrated = overrated;
    this.overratedStats = overratedStats;
  }

  getPolls() {
    const fromRankings = this.rankings.map(r => r.poll_name);
    const fromOver = this.overrated.map(r => r.poll_name);
    return uniqueSorted([...fromRankings, ...fromOver]);
  }

  getYears(poll) {
    return uniqueSorted(
      this.rankings.filter(r => r.poll_name === poll).map(r => r.season_year)
    );
  }

  getWeeks(poll, year) {
    return this.rankings
      .filter(r => r.poll_name === poll && r.season_year === year)
      .map(r => ({
        week_pk: r.ranking_week_fk,
        week_number: r.week_number,
        season_type: r.season_type_name
      }))
      .map(w => ({
        key: `${w.season_type}-${w.week_number}-${w.week_pk}`,
        label: `${w.season_type} Week ${w.week_number}`,
        week_pk: w.week_pk
      }))
      .filter((v, i, arr) => arr.findIndex(x => x.key === v.key) === i)
      .sort((a, b) => a.week_pk - b.week_pk);
  }

  getRankingsByWeekPk(poll, week_pk) {
    return this.rankings
      .filter(r => r.poll_name === poll && r.ranking_week_fk === week_pk)
      .sort((a, b) => a.ranking_current_rank - b.ranking_current_rank);
  }

  getTeamsForOverrated(poll) {
    return uniqueSorted(
      this.overrated.filter(r => r.poll_name === poll).map(r => r.team_name)
    );
  }

  getOverratedSeries(poll, team) {
    return this.overrated
      .filter(r => r.poll_name === poll && r.team_name === team)
      .map(r => ({ x: r.season_year, y: r.overrated_index }))
      .sort((a, b) => a.x - b.x);
  }

  getOverratedStat(poll, team) {
    return this.overratedStats.find(
      r => r.poll_name === poll && r.team_name === team
    ) || null;
  }
}

// ---------- App State ----------
class AppState {
  constructor() {
    this.poll = null;
    this.year = null;
    this.week = null; // stores week_pk now
    this.teams = new Set();
    this.maxTeams = 5;
  }
}

// ---------- UI / Rendering ----------
class App {
  constructor(store, state) {
    this.store = store;
    this.state = state;

    // DOM
    this.pollFilter = document.getElementById('pollFilter');
    this.pollInfo = document.getElementById('pollInfo');

    this.yearSelect = document.getElementById('yearSelect');
    this.weekSelect = document.getElementById('weekSelect');
    this.seasonInfo = document.getElementById('seasonInfo');

    this.rankingsTable = document.getElementById('rankingsTable');
    this.rankingsTbody = this.rankingsTable.querySelector('tbody');
    this.rankingsEmpty = document.getElementById('rankingsEmpty');

    this.teamSelect = document.getElementById('teamSelect');
    this.overratedChartEl = document.getElementById('overratedChart');
    this.overratedEmpty = document.getElementById('overratedEmpty');
    this.overratedStatsTable = document.getElementById('overratedStatsTable');
    this.overratedStatsTbody = this.overratedStatsTable.querySelector('tbody');
    this.overratedStatsEmpty = document.getElementById('overratedStatsEmpty');

    this.topOverratedCount = document.getElementById('topOverratedCount');
    this.topOverratedTable = document.getElementById('topOverratedTable');
    this.topOverratedTbody = this.topOverratedTable.querySelector('tbody');
    this.topOverratedEmpty = document.getElementById('topOverratedEmpty');
    this.topMode = document.getElementById('topMode');



    this.chart = null;
  }

  initEvents() {
      // Poll selector
      this.pollFilter.addEventListener('change', () => {
        this.state.poll = this.pollFilter.value;
        this.populateYearWeekDefaults();
        this.populateTeamChoices();
        this.renderAll();
      });

      // Year selector
      this.yearSelect.addEventListener('change', () => {
        this.state.year = Number(this.yearSelect.value);
        this.populateWeeks();
        this.state.week = Number(this.weekSelect.value);
        this.renderRankings();
      });

      // Week selector
      this.weekSelect.addEventListener('change', () => {
        this.state.week = Number(this.weekSelect.value);
        this.renderRankings();
      });

      // Team selector
      this.teamSelect.addEventListener('change', () => {
        const selected = Array.from(this.teamSelect.selectedOptions).map(o => o.value);
        if (selected.length > this.state.maxTeams) {
          alert(`You can select up to ${this.state.maxTeams} teams.`);
          while (this.teamSelect.selectedOptions.length > this.state.maxTeams) {
            this.teamSelect.selectedOptions[this.teamSelect.selectedOptions.length - 1].selected = false;
          }
          return;
        }
        this.state.teams = new Set(selected);
        this.renderOverrated();
      });

      // 🔑 Top Overrated/Underrated widgets
      this.topOverratedCount.addEventListener('change', () => {
        this.renderTopOverrated();
      });
      this.topMode.addEventListener('change', () => {
        this.renderTopOverrated();
      });
    }


  // ----- Populate controls -----
  populatePolls() {
    const polls = this.store.getPolls();
    this.pollFilter.innerHTML = polls.map(p => `<option value="${p}">${p}</option>`).join('');
    const defaultPoll = polls.includes('AP Top 25') ? 'AP Top 25' : polls[0] || '';
    this.state.poll = defaultPoll;
    this.pollFilter.value = defaultPoll;
    this.pollInfo.textContent = polls.length ? `(${polls.length} polls available)` : '(no polls)';
  }

  populateYearWeekDefaults() {
    const years = this.store.getYears(this.state.poll);
    this.yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    this.state.year = years.length ? Number(years[years.length - 1]) : null;
    if (this.state.year != null) this.yearSelect.value = String(this.state.year);
    this.populateWeeks();
    const weeks = this.store.getWeeks(this.state.poll, this.state.year);
    this.state.week = weeks.length ? weeks[weeks.length - 1].week_pk : null;
    if (this.state.week != null) this.weekSelect.value = String(this.state.week);
  }

  populateWeeks() {
    const weeks = this.store.getWeeks(this.state.poll, this.state.year);
    this.weekSelect.innerHTML = weeks.map(w =>
      `<option value="${w.week_pk}">${w.label}</option>`
    ).join('');
    this.seasonInfo.textContent = weeks.length ? `(${weeks.length} weeks)` : '(no weeks)';
  }

  populateTeamChoices() {
    const teams = this.store.getTeamsForOverrated(this.state.poll);
    this.teamSelect.innerHTML = teams.map(t => `<option value="${t}">${t}</option>`).join('');
    const keep = [...this.state.teams].filter(t => teams.includes(t)).slice(0, this.state.maxTeams);
    this.state.teams = new Set(keep);
    Array.from(this.teamSelect.options).forEach(opt => { opt.selected = this.state.teams.has(opt.value); });
  }

  // ----- Renders -----
  renderTopOverrated() {
      const { poll } = this.state;
      if (!poll) return;

      const limit = Number(this.topOverratedCount.value) || 20;
      const mode = this.topMode.value; // "overrated" or "underrated"

      let stats = this.store.overratedStats
        .filter(r => r.poll_name === poll)
        .map(r => ({
          team: r.team_name,
          avg: Number(r.avg_overrated_index),
          seasons: r.seasons_counted
        }));

      if (mode === 'overrated') {
        stats = stats.sort((a, b) => b.avg - a.avg);
      } else {
        stats = stats.sort((a, b) => a.avg - b.avg);
      }

      stats = stats.slice(0, limit);

      if (!stats.length) {
        this.topOverratedTable.style.display = 'none';
        this.topOverratedEmpty.style.display = '';
        return;
      }

      this.topOverratedEmpty.style.display = 'none';
      this.topOverratedTable.style.display = '';
      this.topOverratedTbody.innerHTML = stats.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.team}</td>
          <td>${r.avg.toFixed(2)}</td>
          <td>${r.seasons}</td>
        </tr>
      `).join('');
    }



  renderRankings() {
    const { poll, week } = this.state;
    const rows = (poll && week != null) ? this.store.getRankingsByWeekPk(poll, Number(week)) : [];
    if (!rows.length) {
      this.rankingsTable.style.display = 'none';
      this.rankingsEmpty.style.display = '';
      return;
    }
    this.rankingsEmpty.style.display = 'none';
    this.rankingsTable.style.display = '';
    this.rankingsTbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.ranking_current_rank}</td>
        <td>${r.team_name}</td>
        <td>${r.ranking_points ?? ''}</td>
        <td>${r.ranking_first_place_votes ?? ''}</td>
      </tr>
    `).join('');
  }

  renderOverrated() {
    const teams = [...this.state.teams];
    if (!teams.length) {
      if (this.chart) { this.chart.destroy(); this.chart = null; }
      this.overratedEmpty.style.display = '';
    } else {
      this.overratedEmpty.style.display = 'none';
      const datasets = teams.map(team => {
        const series = this.store.getOverratedSeries(this.state.poll, team);
        return {
          label: team,
          borderColor: stableColorFor(team),
          backgroundColor: 'transparent',
          data: series,
          tension: 0.25
        };
      });
      if (this.chart) this.chart.destroy();
      this.chart = new Chart(this.overratedChartEl, {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { type: 'linear', title: { display: true, text: 'Season Year' }, ticks: { precision: 0 } },
            y: { title: { display: true, text: 'Overrated Index (start - end)' } }
          },
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }

    if (!teams.length) {
      this.overratedStatsTable.style.display = 'none';
      this.overratedStatsEmpty.style.display = '';
    } else {
      this.overratedStatsEmpty.style.display = 'none';
      this.overratedStatsTable.style.display = '';
      this.overratedStatsTbody.innerHTML = teams.map(team => {
        const stat = this.store.getOverratedStat(this.state.poll, team);
        const avg = stat ? Number(stat.avg_overrated_index).toFixed(2) : '—';
        const seasons = stat ? stat.seasons_counted : '—';
        return `<tr><td>${team}</td><td>${avg}</td><td>${seasons}</td></tr>`;
      }).join('');
    }
  }

  renderAll() {
      this.renderRankings();
      this.renderOverrated();
      this.renderTopOverrated(); // ✅ ensures widget updates
    }

  async boot() {
    await this.store.load();
    this.populatePolls();
    this.populateYearWeekDefaults();
    this.populateTeamChoices();
    this.initEvents();
    this.renderAll();
  }
}

// ---------- Start ----------
const store = new DataStore();
const state = new AppState();
const app = new App(store, state);
app.boot().catch(err => {
  console.error('Failed to initialize app:', err);
  alert('Failed to load data. Check the console for details.');
});
