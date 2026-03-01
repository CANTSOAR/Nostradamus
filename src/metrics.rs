use crate::entities::Agent;
use crate::spatial;
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;

/// Monthly metrics collector that writes county-level snapshots to CSV.
pub struct MetricsCollector {
    file: File,
    month_counter: u32,
}

impl std::fmt::Debug for MetricsCollector {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MetricsCollector").field("month_counter", &self.month_counter).finish()
    }
}

impl MetricsCollector {
    pub fn new() -> Option<Self> {
        fs::create_dir_all("data/output").ok()?;
        let mut file = File::create("data/output/metrics.csv").ok()?;
        writeln!(file, "tick,month,county,population,avg_wealth,avg_income,wealth_disparity,total_location_value,unemployment_rate,avg_health,homeownership_rate").ok()?;
        Some(Self { file, month_counter: 0 })
    }

    /// Record one monthly snapshot — writes one row per county.
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

        for county_id in 0..21u8 {
            let agents_in = county_agents.get(&county_id);
            let pop = agents_in.map(|a| a.len()).unwrap_or(0) as u32;
            if pop == 0 { continue; }

            let agents_slice = agents_in.unwrap();
            let total_wealth: f32 = agents_slice.iter().map(|a| a.wealth).sum();
            let avg_wealth = total_wealth / pop as f32;
            let total_income: f32 = agents_slice.iter().map(|a| a.income).sum();
            let avg_income = total_income / pop as f32;

            // Wealth disparity (std_dev / mean)
            let variance: f32 = agents_slice.iter()
                .map(|a| (a.wealth - avg_wealth).powi(2))
                .sum::<f32>() / pop as f32;
            let disparity = (variance.sqrt() / (avg_wealth.abs() + 1.0)).clamp(0.0, 1.0);

            let total_loc_val = county_loc_value.get(&county_id).copied().unwrap_or(0.0);

            // Unemployment: working-age adults without employer
            let working_age: usize = agents_slice.iter().filter(|a| a.age >= 18 && a.age < 65).count();
            let employed: usize = agents_slice.iter()
                .filter(|a| a.age >= 18 && a.age < 65 && a.employer_location_id.is_some()).count();
            let unemployment = if working_age > 0 {
                1.0 - (employed as f32 / working_age as f32)
            } else { 0.0 };

            let avg_health: f32 = agents_slice.iter().map(|a| a.health).sum::<f32>() / pop as f32;

            let homeowners: usize = agents_slice.iter().filter(|a| a.is_homeowner).count();
            let homeownership = homeowners as f32 / pop as f32;

            let county_name = spatial::county_name(county_id);
            let _ = writeln!(self.file,
                "{},{},{},{},{:.2},{:.2},{:.4},{:.0},{:.4},{:.4},{:.4}",
                tick, self.month_counter, county_name, pop,
                avg_wealth, avg_income, disparity, total_loc_val,
                unemployment, avg_health, homeownership
            );
        }
        let _ = self.file.flush();
    }
}
