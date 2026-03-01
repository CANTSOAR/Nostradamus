// Real NJ County boundaries from Census TIGER/Line via Plotly open dataset
import njCountyData from './nj_counties.json';

const njCounties: GeoJSON.FeatureCollection = njCountyData as GeoJSON.FeatureCollection;

export default njCounties;
