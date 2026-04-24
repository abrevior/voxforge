use anyhow::Result;
use reqwest::multipart;

pub struct TranscribeClient {
    api_key: String,
    api_base: String,
    model: String,
}

impl TranscribeClient {
    pub fn new(api_key: String, api_base: String, model: String) -> Self {
        Self {
            api_key,
            api_base,
            model,
        }
    }

    pub async fn transcribe(&self, audio_bytes: Vec<u8>, language: &str) -> Result<String> {
        if self.api_key.is_empty() {
            return Err(anyhow::anyhow!("OpenAI API key not configured"));
        }

        let client = reqwest::Client::new();
        let url = format!("{}/audio/transcriptions", self.api_base);

        let form = multipart::Form::new()
            .part(
                "file",
                multipart::Part::bytes(audio_bytes)
                    .file_name("audio.wav")
                    .mime_str("audio/wav")?,
            )
            .text("model", self.model.clone())
            .text("language", language.to_string());

        let response = client
            .post(&url)
            .bearer_auth(&self.api_key)
            .multipart(form)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("API error: {}", error_text));
        }

        let result: TranscribeResponse = response.json().await?;
        Ok(result.text)
    }
}

#[derive(serde::Deserialize)]
struct TranscribeResponse {
    text: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = TranscribeClient::new(
            "test-key".to_string(),
            "https://api.openai.com/v1".to_string(),
            "whisper-1".to_string(),
        );
        assert_eq!(client.model, "whisper-1");
    }
}
