use crate::entities::Agent;
use crate::spatial;
use std::collections::{HashMap, VecDeque};
use std::fs::{self, File};
use std::io::Write;

/// A single time-series snapshot (stored in ring buffer for get_history queries)
#[derive(Debug, Clone)]
pub struct MetricsSnapshot {
    pub tick: u64,
    pub month: u32,
    // Statewide
    pub population: u32,
    pub avg_wealth: f32,
    pub total_economy_value: f64,
    pub unemployment_rate: f32,
    pub avg_health: f32,
    pub homeownership_rate: f32,
    pub avg_income: f32,
    // Per-county
    pub county_populations: [u32; 21],
    pub county_avg_wealth: [f32; 21],
    pub county_unemployment: [f32; 21],
}

/// Monthly metrics collector: writes CSV + keeps in-memory ring buffer.
pub struct MetricsCollector {
    file: File,
    month_counter: u32,
    history: VecDeque<MetricsSnapshot>,
}

const MAX_HISTORY: usize = 2000;

impl std::fmt::Debug for MetricsCollector {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MetricsCollector")
            .field("month_counter", &self.month_counter)
            .field("history_len", &self.history.len())
            .finish()
    }
}

impl MetricsCollector {
    pub fn new() -> Option<Self> {
        fs::create_dir_all("data/output").ok()?;
        let mut file = File::create("data/output/metrics.csv").ok()?;
        writeln!(file, "tick,month,county,population,avg_wealth,avg_income,wealth_disparity,total_location_value,unemployment_rate,avg_health,homeownership_rate").ok()?;
        Some(Self { file, month_counter: 0, history: VecDeque::with_capacity(MAX_HISTORY) })
    }

    /// Record one monthly snapshot — writes one row per county to CSV + stores snapshot.
    pub fn record(
        &mut self,
        tick: u64,
        agents: &[Agent],
        locations: &HashMap<u32, spatial::Location>,
    ) {
        self.month_counter += 1;

        // Group agents by county
        let mut county_agents: HashMap<u8, Vec<&Agent>> = HashMap::new();
        for agent in agents {
            county_agents.entry(agent.county).or_default().push(agent);
        }

        // Sum location values by county
        let mut county_loc_value: HashMap<u8, f64> = HashMap::new();
        for loc in locations.values() {
            *county_loc_value.entry(loc.county).or_default() += loc.value as f64;
        }

        // Build statewide aggregates for snapshot
        let total_pop = agents.len() as u32;
        let total_wealth: f32 = agents.iter().map(|a| a.wealth).sum();
        let total_income: f32 = agents.iter().map(|a| a.income).sum();
        let total_health: f32 = agents.iter().map(|a| a.health).sum();
        let working_age_total: usize = agents.iter().filter(|a| a.age >= 18 && a.age < 65).count();
        let employed_total: usize = agents.iter()
            .filter(|a| a.age >= 18 && a.age < 65 && a.employer_location_id.is_some()).count();
        let homeowners_total: usize = agents.iter().filter(|a| a.is_homeowner).count();
        let total_loc_val: f64 = county_loc_value.values().sum();

        let mut snapshot = MetricsSnapshot {
            tick,
            month: self.month_counter,
            population: total_pop,
            avg_wealth: if total_pop > 0 { total_wealth / total_pop as f32 } else { 0.0 },
            total_economy_value: total_loc_val,
            unemployment_rate: if working_age_total > 0 { 1.0 - (employed_total as f32 / working_age_total as f32) } else { 0.0 },
            avg_health: if total_pop > 0 { total_health / total_pop as f32 } else { 0.0 },
            homeownership_rate: if total_pop > 0 { homeowners_total as f32 / total_pop as f32 } else { 0.0 },
            avg_income: if total_pop > 0 { total_income / total_pop as f32 } else { 0.0 },
            county_populations: [0; 21],
            county_avg_wealth: [0.0; 21],
            county_unemployment: [0.0; 21],
        };

        for county_id in 0..21u8 {
            let agents_in = county_agents.get(&county_id);
            let pop = agents_in.map(|a| a.len()).unwrap_or(0) as u32;
            if pop == 0 { continue; }

            let agents_slice = agents_in.unwrap();
            let total_w: f32 = agents_slice.iter().map(|a| a.wealth).sum();
            let avg_wealth = total_w / pop as f32;
            let total_inc: f32 = agents_slice.iter().map(|a| a.income).sum();
            let avg_income = total_inc / pop as f32;

            let variance: f32 = agents_slice.iter()
                .map(|a| (a.wealth - avg_wealth).powi(2))
                .sum::<f32>() / pop as f32;
            let disparity = (variance.sqrt() / (avg_wealth.abs() + 1.0)).clamp(0.0, 1.0);

            let total_lv = county_loc_value.get(&county_id).copied().unwrap_or(0.0);

            let working_age: usize = agents_slice.iter().filter(|a| a.age >= 18 && a.age < 65).count();
            let employed: usize = agents_slice.iter()
                .filter(|a| a.age >= 18 && a.age < 65 && a.employer_location_id.is_some()).count();
            let unemployment = if working_age > 0 { 1.0 - (employed as f32 / working_age as f32) } else { 0.0 };

            let avg_health: f32 = agents_slice.iter().map(|a| a.health).sum::<f32>() / pop as f32;
            let homeowners: usize = agents_slice.iter().filter(|a| a.is_homeowner).count();
            let homeownership = homeowners as f32 / pop as f32;

            // Fill per-county snapshot arrays
            snapshot.county_populations[county_id as usize] = pop;
            snapshot.county_avg_wealth[county_id as usize] = avg_wealth;
            snapshot.county_unemployment[county_id as usize] = unemployment;

            let county_name = spatial::county_name(county_id);
            let _ = writeln!(self.file,
                "{},{},{},{},{:.2},{:.2},{:.4},{:.0},{:.4},{:.4},{:.4}",
                tick, self.month_counter, county_name, pop,
                avg_wealth, avg_income, disparity, total_lv,
                unemployment, avg_health, homeownership
            );
        }
        let _ = self.file.flush();

        // Store snapshot in ring buffer
        if self.history.len() >= MAX_HISTORY {
            self.history.pop_front();
        }
        self.history.push_back(snapshot);
    }

    /// Query time-series data for the AI agent's get_history command.
    pub fn get_history(&self, metric: &str, county: Option<u8>, limit: usize) -> Vec<(u64, f64)> {
        let start = if self.history.len() > limit { self.history.len() - limit } else { 0 };
        
        self.history.iter().skip(start).map(|s| {
            let val = match (metric, county) {
                ("population", None) => s.population as f64,
                ("population", Some(cid)) => s.county_populations.get(cid as usize).copied().unwrap_or(0) as f64,
                ("avg_wealth", None) => s.avg_wealth as f64,
                ("avg_wealth", Some(cid)) => s.county_avg_wealth.get(cid as usize).copied().unwrap_or(0.0) as f64,
                ("total_economy" | "total_economy_value", _) => s.total_economy_value,
                ("unemployment" | "unemployment_rate", None) => s.unemployment_rate as f64,
                ("unemployment" | "unemployment_rate", Some(cid)) => s.county_unemployment.get(cid as usize).copied().unwrap_or(0.0) as f64,
                ("avg_health" | "health", _) => s.avg_health as f64,
                ("homeownership" | "homeownership_rate", _) => s.homeownership_rate as f64,
                ("avg_income" | "income", _) => s.avg_income as f64,
                _ => 0.0,
            };
            (s.tick, val)
        }).collect()
    }
}
