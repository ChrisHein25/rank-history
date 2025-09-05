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

class ColorManager {
  constructor() {
    this.palette = [
      '#e41a1c', '#377eb8', '#4daf4a', '#984ea3',
      '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999',
      '#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854'
    ];
    this.assigned = new Map(); // team -> color
    this.available = [...this.palette];
  }

  getColor(team) {
    if (this.assigned.has(team)) {
      return this.assigned.get(team);
    }
    const color = this.available.shift() || '#000'; // fallback black
    this.assigned.set(team, color);
    return color;
  }

  release(team) {
    if (this.assigned.has(team)) {
      const color = this.assigned.get(team);
      this.assigned.delete(team);
      this.available.push(color); // recycle
    }
  }

  reset() {
    this.assigned.clear();
    this.available = [...this.palette];
  }
}


// ---------- Data Layer ----------
class DataStore {
  constructor() {
    this.rankings = [];
    this.overrated = [];
    this.overratedStats = [];
    this.alltime = [];
  }

  async load() {
    const [rankings, overrated, overratedStats, alltime] = await Promise.all([
      fetchJSONSafe('./data/rankings.json'),
      fetchJSONSafe('./data/overrated.json'),
      fetchJSONSafe('./data/overrated_stats.json'),
      fetchJSONSafe('./data/alltime_summary.json'),
    ]);
    this.rankings = rankings;
    this.overrated = overrated;
    this.overratedStats = overratedStats;
    this.alltime = alltime;
  }

  getPolls() {
    const fromRankings = this.rankings.map(r => r.poll_name);
    const fromOver = this.overrated.map(r => r.poll_name);
    return uniqueSorted([...fromRankings, ...fromOver]);
  }

  getAlltimeStats(poll) {
      return this.alltime
        .filter(r => r.poll_name === poll)
        .sort((a, b) => b.total_weeks_ranked - a.total_weeks_ranked);
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
        .map(r => ({
          x: r.season_year,
          y: r.overrated_index,
          start: r.start_rank ?? 'Unranked',
          end: r.end_rank ?? 'Unranked'
        }))
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

    this.alltimeSort = { column: 'total_weeks_ranked', dir: 'desc' };
  }
}

// ---------- UI / Rendering ----------
class App {
  constructor(store, state) {
    this.store = store;
    this.state = state;

    // color manager
    this.colorManager = new ColorManager();

    this.alltimeCount = document.getElementById('alltimeCount');
    this.alltimeTable = document.getElementById('alltimeTable');
    this.alltimeTbody = this.alltimeTable.querySelector('tbody');
    this.alltimeEmpty = document.getElementById('alltimeEmpty');


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
    this.topMinSeasons = document.getElementById('topMinSeasons');

    this.chart = null;
  }

  initEvents() {

    this.alltimeCount.addEventListener('change', () => this.renderAlltime());
    // Alltime table sorting
    this.alltimeTable.querySelectorAll('th').forEach((th, i) => {
      const colMap = {
        1: 'team_name',
        2: 'total_weeks_ranked',
        3: 'weeks_at_number_one',
        4: 'weeks_in_top_3',
        5: 'weeks_in_top_10'
      };
      const col = colMap[i];
      if (!col) return;

      th.classList.add('sortable'); // mark as clickable

      th.addEventListener('click', () => {
        if (this.state.alltimeSort.column === col) {
          // toggle direction
          this.state.alltimeSort.dir = this.state.alltimeSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.alltimeSort.column = col;
          this.state.alltimeSort.dir = 'desc';
        }
        this.renderAlltime();
        this.updateAlltimeHeaders();
      });
    });



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

    // Top widget filters
    this.topOverratedCount.addEventListener('change', () => this.renderTopOverrated());
    this.topMode.addEventListener('change', () => this.renderTopOverrated());
    this.topMinSeasons.addEventListener('change', () => this.renderTopOverrated());
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

  // ✅ keep selected if in state
  Array.from(this.teamSelect.options).forEach(opt => {
    opt.selected = this.state.teams.has(opt.value);
  });
}

  // ----- Renders -----
  renderAlltime() {
      const { poll } = this.state;
      if (!poll) return;

      const limit = Number(this.alltimeCount.value) || 20;
      let rows = this.store.getAlltimeStats(poll);

      // apply sorting
      const { column, dir } = this.state.alltimeSort;
      rows = rows.sort((a, b) => {
        if (typeof a[column] === 'string') {
          return dir === 'asc'
            ? a[column].localeCompare(b[column])
            : b[column].localeCompare(a[column]);
        } else {
          return dir === 'asc'
            ? a[column] - b[column]
            : b[column] - a[column];
        }
      });

      rows = rows.slice(0, limit);

      if (!rows.length) {
        this.alltimeTable.style.display = 'none';
        this.alltimeEmpty.style.display = '';
        return;
      }

      this.alltimeEmpty.style.display = 'none';
      this.alltimeTable.style.display = '';
      this.alltimeTbody.innerHTML = rows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.team_name}</td>
          <td>${r.total_weeks_ranked}</td>
          <td>${r.weeks_at_number_one}</td>
          <td>${r.weeks_in_top_3}</td>
          <td>${r.weeks_in_top_10}</td>
        </tr>
      `).join('');

      this.updateAlltimeHeaders();

    }

    updateAlltimeHeaders() {
      const headers = this.alltimeTable.querySelectorAll('th');
      headers.forEach((th, i) => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        const colMap = {
          1: 'team_name',
          2: 'total_weeks_ranked',
          3: 'weeks_at_number_one',
          4: 'weeks_in_top_3',
          5: 'weeks_in_top_10'
        };
        const col = colMap[i];
        if (col === this.state.alltimeSort.column) {
          th.classList.add(this.state.alltimeSort.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
      });
    }


  renderTopOverrated() {
    const { poll } = this.state;
    if (!poll) return;

    const limit = Number(this.topOverratedCount.value) || 20;
    const mode = this.topMode.value; // "overrated" or "underrated"
    const minSeasons = Number(this.topMinSeasons.value) || 0;

    let stats = this.store.overratedStats
      .filter(r => r.poll_name === poll && r.seasons_counted >= minSeasons)
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

      // Clean up released colors
      for (const [team] of this.colorManager.assigned) {
        if (!teams.includes(team)) this.colorManager.release(team);
      }

      if (!teams.length) {
        if (this.chart) { this.chart.destroy(); this.chart = null; }
        this.overratedEmpty.style.display = '';
      } else {
        this.overratedEmpty.style.display = 'none';
        const datasets = teams.map(team => {
          const series = this.store.getOverratedSeries(this.state.poll, team);
          return {
            label: team,
            borderColor: this.colorManager.getColor(team),
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
              x: {
                type: 'linear',
                title: { display: true, text: 'Season Year' },
                ticks: {
                  callback: (value) => String(value)  // force plain string, no commas
                }
              },
              y: {
                title: { display: true, text: 'Overrated Index' }
              }
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'line'
                }
              },
              tooltip: {
                callbacks: {
                    title: (ctx) => {
                      const year = String(ctx[0].raw.x); // safe access
                      return `${ctx[0].dataset.label} (${year})`;
                    },
                    label: (ctx) => {
                      const d = ctx.raw;
                      const year = String(d.x); // no commas like 2,004
                      const start = d.start ?? 'Unranked';
                      const end = d.end ?? 'Unranked';
                      return `Index ${d.y}, Start: ${start}, End: ${end}`;
                    }
                  }
              }
            }
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
      this.renderTopOverrated();
      this.renderAlltime();
    }

  async boot() {
      await this.store.load();
      this.populatePolls();
      this.populateYearWeekDefaults();

      // ✅ Preselect overrated chart teams
      const defaultTeams = ["Alabama", "Ohio State", "Notre Dame"];//, "Texas", "LSU"];
      this.state.teams = new Set(defaultTeams);

      this.populateTeamChoices(); // will respect .state.teams
      this.initEvents();
      this.renderAll();
      this.updateAlltimeHeaders();
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
