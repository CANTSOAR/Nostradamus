use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::env;

#[derive(Debug, Serialize)]
struct GroqMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct GroqRequest {
    model: String,
    messages: Vec<GroqMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct GroqResponse {
    choices: Vec<GroqChoice>,
}

#[derive(Debug, Deserialize)]
struct GroqChoice {
    message: GroqResponseMessage,
}

#[derive(Debug, Deserialize)]
struct GroqResponseMessage {
    content: String,
}

#[derive(Debug)]
pub struct GroqClient {
    client: Client,
    api_key: String,
    model: String,
}

impl GroqClient {
    pub fn new() -> Self {
        let api_key = env::var("GROQ_API_KEY").unwrap_or_else(|_| "".to_string());
        Self {
            client: Client::new(),
            api_key,
            model: "llama-3.3-70b-versatile".to_string(), // Typical high-performance Groq model
        }
    }

    pub async fn query(&self, prompt: &str, system_context: &str) -> Result<String, String> {
        if self.api_key.is_empty() {
            return Err("GROQ_API_KEY not set in environment".to_string());
        }

        let url = "https://api.groq.com/openai/v1/chat/completions";
        
        let request = GroqRequest {
            model: self.model.clone(),
            messages: vec![
                GroqMessage {
                    role: "system".to_string(),
                    content: system_context.to_string(),
                },
                GroqMessage {
                    role: "user".to_string(),
                    content: prompt.to_string(),
                },
            ],
            temperature: Some(0.2),
            max_tokens: Some(1024),
        };

        let response = self.client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let err_text = response.text().await.unwrap_or_default();
            return Err(format!("Groq API error: {}", err_text));
        }

        let res_body: GroqResponse = response.json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        res_body.choices.first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| "No response from Groq".to_string())
    }
}
