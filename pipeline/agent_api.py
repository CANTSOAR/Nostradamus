import os
import json
import traceback
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load dataframes into memory
print("Loading dataframes into memory...")
try:
    # Use relative paths from the pipeline directory
    data_dir = os.path.join("..", "frontend", "public", "data")
    
    # Load Municipalities
    muni_path = os.path.join(data_dir, "nj_municipalities_enriched.geojson")
    with open(muni_path, 'r') as f:
        muni_geojson = json.load(f)
    muni_features = [f["properties"] for f in muni_geojson["features"]]
    df_municipalities = pd.DataFrame(muni_features)
    print(f"Loaded {len(df_municipalities)} municipalities.")

    # Load Tracts
    tract_path = os.path.join(data_dir, "nj_tracts_enriched.geojson")
    with open(tract_path, 'r') as f:
        tract_geojson = json.load(f)
    tract_features = [f["properties"] for f in tract_geojson["features"]]
    df_tracts = pd.DataFrame(tract_features)
    print(f"Loaded {len(df_tracts)} tracts.")
except Exception as e:
    print(f"Warning: Failed to load dataframes: {e}")
    df_municipalities = pd.DataFrame()
    df_tracts = pd.DataFrame()

# Initialize Groq client
if os.getenv("GROQ_API_KEY"):
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
else:
    print("Warning: GROQ_API_KEY not found in environment.")
    client = None

class QueryRequest(BaseModel):
    query: string

class QueryResponse(BaseModel):
    answer_text: string
    matched_geoids: list[str]
    code_executed: string
    error: string | None = None

system_prompt = """You are a Python coding assistant.
You have access to two pandas DataFrames:
1. `df_municipalities` (representing New Jersey municipalities)
2. `df_tracts` (representing New Jersey census tracts)

Both dataframes have a 'geoid' column and various demographic, economic, and geographic columns.
Your task is to write a Python script that answers the user's question and filters these dataframes to find specific matching 'geoid' values.

You must output valid Python code enclosed in ```python ... ``` markdown blocks.
The code you write will be executed via `exec()`.
Your code MUST define two local variables at the end of its execution:
- `result_text`: A string containing the natural language answer to the user's question.
- `matched_geoids`: A Python list of string 'geoid' values that represent the areas you found.

DO NOT use `print()` statements for the final output. Only set those two variables.

Example Output format:
```python
import pandas as pd
# Your logic here to filter df_municipalities or df_tracts
filtered_df = df_municipalities[df_municipalities['median_income'] > 100000]

matched_geoids = filtered_df['geoid'].tolist()
result_text = f"Found {len(matched_geoids)} municipalities with a median income over $100,000."
```
"""

@app.post("/query", response_model=QueryResponse)
async def process_query(req: QueryRequest):
    if not client:
        raise HTTPException(status_code=500, detail="Groq API key not configured.")

    try:
        # 1. Ask Groq to generate code
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.query}
            ],
            temperature=0.1,
            max_tokens=2048,
        )
        
        agent_reply = response.choices[0].message.content
        
        # 2. Extract Python code block
        code_str = ""
        if "```python" in agent_reply:
            code_str = agent_reply.split("```python")[1].split("```")[0].strip()
        elif "```" in agent_reply:
            code_str = agent_reply.split("```")[1].split("```")[0].strip()
        else:
            code_str = agent_reply.strip()

        if not code_str:
            return QueryResponse(
                answer_text="Agent failed to generate Python code.",
                matched_geoids=[],
                code_executed="",
                error="No code block found."
            )

        # 3. Safe Execution Environment
        # We pass the dataframes into the local namespace
        local_env = {
            "df_municipalities": df_municipalities,
            "df_tracts": df_tracts,
            "pd": pd
        }
        
        # 4. Execute Code
        try:
            exec(code_str, {}, local_env)
        except Exception as e:
            return QueryResponse(
                answer_text="Error executing code.",
                matched_geoids=[],
                code_executed=code_str,
                error=traceback.format_exc()
            )

        # 5. Extract Results
        result_text = local_env.get("result_text", "Done.")
        matched_geoids = local_env.get("matched_geoids", [])

        # Ensure string IDs
        matched_geoids = [str(gid) for gid in matched_geoids]

        return QueryResponse(
            answer_text=str(result_text),
            matched_geoids=matched_geoids,
            code_executed=code_str
        )

    except Exception as e:
         return QueryResponse(
            answer_text="Server Error",
            matched_geoids=[],
            code_executed="",
            error=str(e)
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
