## VITALS: Agentic AI Healthcare
**Team UNFAZED**

---

### 👥 Team Members

| Name | Role | GitHub |
| :--- | :--- | :--- |
| **Aryan Saini** | Team Leader / Frontend | @aryan-saini-dev |
| **Aryan Gusain** | Backend / AI Logic | @AryanGusain-dev |
| **Anshika Garg** | Documentation / Testing | @anshii123 |
| **Ansh Thakur** | Backend / AI Logic | @anshthakur-GH |

---

### 💡 Problem Statement
Current healthcare is reactive and manual, leading to three primary systemic failures:

* **Ignoring Symptoms:** Chronic patients often overlook subtle symptom links (e.g., a "metallic taste" in Type 2 Diabetes indicating a shift to Type 3), which leads to preventable emergencies.
* **Staff Overload:** Medical professionals are too burdened to provide continuous manual monitoring for every chronic patient at home.
* **Efficiency Loss:** Manual history-taking consumes the majority of a patient's visit, leaving minimal time for actual treatment and consultation.

---

### 🛠️ Tech Stack

* **Core Intelligence:** Gemini API (Agentic Reasoning & Pattern Recognition)
* **Orchestration:** n8n (Workflow Automation) & LangChain
* **Voice Pipeline:** Browser Web Speech API (Mocking Twilio/Vapi/ElevenLabs for web-based calling)
* **Database:** Supabase (Patient History & Vector DB)
* **Transcription:** Deepgram (Speech-to-Text)
* **Frontend:** React/Vite with Tailwind CSS

---

### 🔗 Links
* **Live Demo:** [Insert Link Here]
* **Video Demo:** [Insert Link Here]
* **Presentation:** [Link to Team Unfazed Stellaris.pdf]

---

### 📸 Screenshots

**Call Interface**
![Call Interface](/images/Screenshot%202026-03-28%20154000.png)

**Patient History Sidebar**
![Patient History](/images/Screenshot%202026-03-28%20181544.png)

**Doctor Approval Dashboard**
![Doctor Dashboard](/images/Screenshot%202026-03-28%20181554.png)

**Voice Interaction View**
![Voice Interaction](/images/Screenshot%202026-03-28%20181600.png)

**Patient Data Analysis**
![Data Analysis](/images/Screenshot%202026-03-28%20182059.png)

**Symptom Tracking**
![Symptom Tracking](/images/Screenshot%202026-03-28%20182115.png)

**Dashboard Overview**
![Dashboard Overview](/images/Screenshot%202026-03-28%20182130.png)

---

### 🚀 How to Run Locally

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/username/vitals-agentic-ai.git
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file and add your **Gemini API Key** and **Supabase URL/Key**.

4.  **Database Sync:**
    Connect your existing patient database to the workflow as defined in the technical approach.

6.  **Launch Frontend:**
    ```bash
    npm run dev
    ```

7.  **Initiate Mock Call:**
    Use the web interface to start a voice session. The system will autonomously retrieve patient history and begin context-aware questioning.

---