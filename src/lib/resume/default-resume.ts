import type { Resume } from "./types";

/** Transcription of "Sebastian resume Jan 2026.pdf" — the Classic template's reference document. */
export const defaultResume: Resume = {
  version: 1,
  template: "classic",
  title: "Sebastian resume Jan 2026",
  header: {
    name: "SEBASTIAN BELULOK SAGING",
    contacts: [
      { id: "c1", label: "belulok_sebastian@hotmail.com", url: "mailto:belulok_sebastian@hotmail.com" },
      { id: "c2", label: "+6 013 837 3362" },
    ],
  },
  sections: [
    // ------------------------------------------------------------------ LEFT
    {
      id: "education",
      title: "EDUCATION",
      column: "left",
      entries: [
        {
          id: "edu-utm",
          blocks: [
            { id: "b1", type: "title", text: "BACHELOR IN SOFTWARE ENGINEERING – UNIVERSITY TEKNOLOGY MALAYSIA (UTM)" },
            { id: "b2", type: "text", text: "*2025*" },
          ],
        },
        {
          id: "edu-curtin",
          blocks: [
            { id: "b1", type: "title", text: "FOUNDATION IN ENGINEERING & SCIENCE – CURTIN UNIVERSITY MALAYSIA, SARAWAK" },
            { id: "b2", type: "text", text: "*2013*" },
            { id: "b3", type: "bullets", marker: "inline", items: ["CGPA: 2.80"] },
          ],
        },
      ],
    },
    {
      id: "experience",
      title: "EXPERIENCE",
      column: "left",
      headingGap: 2,
      entries: [
        {
          id: "exp-pixlr",
          blocks: [
            { id: "b1", type: "title", text: "PIXLR SDN BHD" },
            { id: "b2", type: "text", text: "**Senior Software Engineer –** *Dec 2025 - Present*" },
            {
              id: "b3",
              type: "bullets",
              marker: "disc",
              align: "justify",
              items: [
                "Integrated prompt management, tool routing, and model selection logic into production systems to ensure consistent output quality across different user scenarios.",
                "Developed RAG-style workflows to enrich model responses with structured internal data, improving accuracy, controllability, and safety of AI-generated content.",
                "Implemented observability and failure handling for AI pipelines, including logging of model inputs/outputs, retry logic, and graceful degradation when external model services failed.",
                "Ensured secure handling of user data and model inputs, including access controls, data sanitization, and compliance with platform privacy requirements.",
              ],
            },
          ],
        },
        {
          id: "exp-valuelabs",
          blocks: [
            { id: "b1", type: "title", text: "VALUELABS SDN BHD (Client: Maxis Berhad)" },
            { id: "b2", type: "text", text: "**Senior Software Engineer –** *June 2025 – Nov 2025*" },
            {
              id: "b3",
              type: "bullets",
              marker: "disc",
              items: [
                "Led backend system design and integration for **enterprise-scale platforms**, focusing on reliability, performance, and API consistency.",
                "Built and maintained backend services supporting **high-throughput data flows and real-time integrations**.",
                "Collaborated with cross-functional teams to translate complex business and operational requirements into scalable system architectures.",
                "Improved system observability and stability through structured logging, monitoring, and incident-driven improvements.",
              ],
            },
          ],
        },
        {
          id: "exp-premium",
          blocks: [
            { id: "b1", type: "title", text: "PREMIUM INFO TECH SDN BHD" },
            { id: "b2", type: "text", text: "**Senior Fullstack Web Engineer –** *Nov 2024 – Jun 2025*" },
            {
              id: "b3",
              type: "bullets",
              marker: "disc",
              spacing: 1.2,
              items: [
                "Designed and integrated agentic AI workflows using LLMs and automation frameworks (n8n), enabling intelligent task routing and tool coordination for customer-facing systems.",
                "Built and deployed **LLM-integrated backend services** in Node.js to support document processing, classification, and AI-assisted decision flows.",
                "Implemented **AI orchestration logic** to coordinate multiple services and tools, improving operational efficiency and reducing manual intervention.",
                "Applied **embeddings and semantic matching techniques** to enhance contextual data retrieval and relevance in AI-assisted workflows.",
                "Ensured **secure API integrations, data governance, and production stability** for AI-enabled backend systems.",
              ],
            },
          ],
        },
        {
          id: "exp-cognizant",
          blocks: [
            { id: "b1", type: "title", text: "COGNIZANT TECHNOLOGY SOLUTIONS CORP" },
            { id: "b2", type: "text", text: "**Software Engineer –** *May 2024 – Nov 2024*" },
            {
              id: "b3",
              type: "bullets",
              marker: "disc",
              align: "justify",
              items: [
                "**Helped reduce** security vulnerabilities by **20%** by conducting comprehensive code reviews and leveraging **generative AI** tools to analyze browser extension code, enhancing overall application security.",
                "**Improved** user experience across multiple web platforms by **analyzing and debugging** complex code, leading to **fewer production incidents** and faster resolution of critical issues.",
                "**Accelerated** release cycles by **30%** through close collaboration with cross- functional teams, implementing best practices for code development and streamlined deployment pipelines.",
                "**Increased** code quality by **25%** by auditing submissions, providing detailed feedback, and ensuring strict adherence to coding standards and project guidelines.",
                "**Maintained** consistency and reliability in the codebase by actively monitoring and reviewing team contributions, effectively **reducing** technical debt and minimizing performance bottlenecks.",
                "**Enhanced** knowledge sharing and mentorship by **facilitating** regular code review sessions, incorporating insights from **generative AI** to guide junior developers toward best practices.",
                "**Contributed** to the successful delivery of web-based projects by **resolving** complex technical challenges, demonstrating strong problem-solving skills and proactive collaboration with stakeholders.",
              ],
            },
          ],
        },
        {
          id: "exp-juno",
          blocks: [
            { id: "b1", type: "title", text: "(JUNO MARKETS) GUINEVERE GLOBAL SDN. BHD." },
            {
              id: "b2",
              type: "text",
              indent: 4,
              text: "**Full stack Web Developer –** *March 2023 – March 2024*\n**Frontend Web Developer –** *October 2022 – March 2023*",
            },
            {
              id: "b3",
              type: "bullets",
              marker: "dot",
              align: "justify",
              spacing: 1.5,
              items: [
                "**Optimized** performance of in-house dashboards and forms by **implementing** TypeScript, React.js, Vue.js, Laravel, AWS, and Runcloud, resulting in **30% faster** page load times and **improved** user satisfaction.",
                "**Reduced** manual tasks by **leveraging** Integromat (Make.com) to create robust **automations**, saving **10+ hours weekly** for the operations team.",
                "**Developed** and maintained dynamic company websites, **integrating** and managing APIs from the backend for **seamless** data flow and **faster** feature rollouts.",
                "**Incorporated** generative AI tools (e.g., **OpenAI GPT models**) to **audit** code and **streamline** form creation, significantly **accelerating** development cycles and **improving** user experience.",
                "**Created** and integrated HubSpot forms with custom automations, **simplifying** process flows and allowing cross-functional teams to **focus** on higher-value tasks.",
              ],
            },
          ],
        },
        {
          id: "exp-realfun",
          blocks: [
            { id: "b1", type: "title", text: "REALFUN ACADEMY SDN. BHD." },
            { id: "b2", type: "text", indent: 4, text: "**STEM Coach & Backend Developer –** *April 2022 – October 2022*" },
            {
              id: "b3",
              type: "bullets",
              marker: "dot",
              align: "justify",
              spacing: 1.5,
              items: [
                "Working on an in-house LMS portal for better course material platform and enhance instructors experience in checking student works andview their progress with Vue.js(front-end), Django(back-end), Heroku and AWS",
                "Designed course plan for courses offered in the academy as well as organized workshops for students interested in tech.",
                "Guided students who are gearing up for coding competitions and mentored them so that they are fully prepared.",
              ],
            },
          ],
        },
        {
          id: "exp-mediaplus",
          blocks: [
            { id: "b1", type: "title", text: "MEDIAPLUS DIGITAL PTE. LTD." },
            {
              id: "b2",
              type: "text",
              indent: 4,
              text: "**Frontend Web Developer & Client Training Specialist –** *Aug 2020 – Mar 2022*\n**Web Developer Intern -** *Feb 2020 – Aug 2020*",
            },
            {
              id: "b3",
              type: "bullets",
              marker: "dot",
              align: "justify",
              spacing: 1.5,
              items: [
                "Custom code theme and plugins and integrate APIs for payment gateway.",
                "Facilitated trainings for clients after production to get them familiarized with the usage of the website that they will be maintaining afterproject handover.",
                "Developed WordPress websites based on mockups done by the design team as well as installing and setting the plugins and themes of thewebsite based on the requirements of the clients. Custom coding PHP, HTML, CSS, JavaScript, jQuery",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "achievement",
      title: "ACHIEVEMENT",
      column: "left",
      gap: 22,
      entries: [
        {
          id: "ach-deriv",
          blocks: [
            { id: "b1", type: "title", text: "Deriv Hackathon 2025 (AI Payment Resolution Tool)" },
            { id: "b2", type: "text", text: "*1^ST^ Place Winner*" },
            { id: "b3", type: "title", text: "AI-Powered Social Trading Platform Using DeepSeek" },
            {
              id: "b4",
              type: "text",
              text: "This project will be an AI-driven social trading platform that helps traders analyze stocks, match traders with the best strategies, and provide real- time AI chatbot assistance for trading-related queries.",
            },
          ],
        },
        {
          id: "ach-sui",
          blocks: [
            { id: "b1", type: "title", text: "SUI BLOCKCHAIN HACKER HOUSE HACKATHON MALAYSIA" },
            { id: "b2", type: "text", text: "*1^ST^ Runner Up Winner*" },
            { id: "b3", type: "title", text: "QuestChain Academy" },
            {
              id: "b4",
              type: "text",
              text: "This project will be an AI-driven web3 learning platform, among other tech subjects. Inspired by web3school but with gamification and interactive experience with added Sui blockchain ecosystem.",
            },
          ],
        },
        {
          id: "ach-iota",
          blocks: [
            { id: "b1", type: "title", text: "IOTA BLOCKCHAIN HACKATHON MALAYSIA" },
            { id: "b2", type: "text", text: "*4^TH^ Place Winner*" },
            { id: "b3", type: "title", text: "EcoMon – Gamified Recycling Platform" },
            {
              id: "b4",
              type: "text",
              text: "This project encourages everyone to recycle and every recycling is tokenized. It is\nPokemon Go style recycling game powered by IOTA blockchain",
            },
          ],
        },
      ],
    },
    {
      id: "additional",
      title: "ADDITIONAL EXPERIENCE",
      column: "left",
      gap: 22,
      entries: [
        {
          id: "add-adnexio",
          blocks: [
            {
              id: "b1",
              type: "title",
              align: "justify",
              text: "Software Engineer External Trainer – adnexioedu (SEC) Software Engineering Conversion Bootcamp",
            },
            { id: "b2", type: "text", text: "*April 2025 – July 2025*\n*October 2023 – December 2023*" },
            {
              id: "b3",
              type: "bullets",
              marker: "dot",
              align: "justify",
              spacing: 1.5,
              items: [
                "**Technical Training & AI Integration**: Conduct comprehensive training sessions for aspiring software engineers, demonstrating best practices in software development and guiding them to install and integrate AI models locally (e.g., OpenAI GPT, local inference setups).",
                "**Curriculum Development**: Enhanced the bootcamp’s curriculum by introducing cutting-edge industry trends in generative AI, automation tools, and modern full- stack frameworks, resulting in a 20% increase in overall student project success rates.",
                "**Automated Dashboard Management**: Developed an AI-driven automated dashboard to streamline teaching workflows, automating code reviews, and flagging potential issues in real time to reduce manual checks.",
                "**Project Guidance & Mentorship:** Provided hands-on guidance on coding projects, demonstrating how to leverage AI for quicker prototyping, improved problem- solving, and efficient debugging, thereby boosting participants’ confidence and coding proficiency.",
                "**Industry Alignment**: Regularly refined course materials to keep pace with evolving software standards, ensuring graduates possess job-ready skills and can effectively integrate AI solutions into real-world applications.",
              ],
            },
          ],
        },
        {
          id: "add-bugcrusher",
          blocks: [
            {
              id: "b1",
              type: "title",
              text: "Workshop Coach and Lead Judge for Senior Technical Category 2023 – BugCrusher Coding Competition",
            },
            { id: "b2", type: "text", text: "*May 2023 – July 2023*" },
            {
              id: "b3",
              type: "bullets",
              marker: "dot",
              align: "justify",
              spacing: 1.5,
              items: [
                "**Coaching and Mentoring:** Led interactive workshops for participants, providing expert coaching and mentoring in advanced coding techniques and best practices.",
                "**Judging and Evaluation:** Served as the Lead Judge for the Senior Technical Category, evaluating coding projects based on technical proficiency, innovation, and problem-solving skills.",
                "**Feedback and Development:** Offered constructive feedback to participants, fostering their technical growth and encouraging creative solutions.",
                "**Event Coordination:** Played a key role in coordinating the competition, ensuring a smooth and fair evaluation process for all entries.",
              ],
            },
          ],
        },
        {
          id: "add-futurelabs",
          blocks: [
            { id: "b1", type: "title", text: "Career Accelerator Program October 2022– Future Labs" },
            { id: "b2", type: "text", text: "*October 2022*" },
            {
              id: "b3",
              type: "bullets",
              marker: "dot",
              align: "justify",
              spacing: 1.5,
              items: [
                "**Mentored Aspiring Software Engineers:** Offered practical guidance in solving assignments and navigating software engineering challenges.",
                "**Resume Coaching:** Instructed participants on crafting effective resumes tailored for software engineering roles.",
                "**Problem-Solving Assistance:** Aided mentees in troubleshooting and finding solutions to technical problems.",
              ],
            },
          ],
        },
      ],
    },

    // ----------------------------------------------------------------- RIGHT
    {
      id: "portfolio",
      title: "PORTFOLIO",
      column: "right",
      entries: [
        {
          id: "port-links",
          blocks: [
            {
              id: "b1",
              type: "links",
              items: [
                { label: "https://my-portfolio-seven-phi-29.vercel.app", url: "https://my-portfolio-seven-phi-29.vercel.app" },
                { label: "linkedin.com/in/sebastian-belulok", url: "https://linkedin.com/in/sebastian-belulok" },
                { label: "github.com/belulok", url: "https://github.com/belulok" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "skills",
      title: "TECHNICAL SKILLS",
      column: "right",
      gap: 19,
      headingGap: 8,
      entries: [
        {
          id: "skills-main",
          blocks: [
            { id: "b1", type: "title", text: "Proficient with:" },
            {
              id: "b2",
              type: "bullets",
              marker: "inline",
              gap: 1,
              items: [
                "Basic AI model fine-tuning",
                "n8n, agentic AI •Python •HTML •CSS",
                "JavaScript •Git •Node.js •Express.js •Ubuntu Linux",
              ],
            },
            { id: "b3", type: "title", text: "Familiar with:", gap: 10 },
            {
              id: "b4",
              type: "bullets",
              marker: "inline",
              spacing: 0.8,
              items: [
                "Flowise •Hugging Face Transformers •Ollama & Deepseek •OpenAI GPT Models and API",
                "LangChain •PyTorch / TensorFlow •Django •C",
                "C++ •Java •PHP •Flutter •MongoDB •MYSQL",
                "PSQL •Dockers •Heroku •ReactJs •TypeScript",
                "AWS",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "skills-dev",
      title: "SKILLS DEVELOPMENT",
      column: "right",
      gap: 9,
      headingGap: 12,
      entries: [
        {
          id: "sd-42",
          blocks: [
            { id: "b1", type: "title", text: "école 42KL" },
            {
              id: "b2",
              type: "text",
              text: "**Piscine –** *January 2024 – February 2024*\n**Cadet  –** *February 2024 – Present*",
            },
            {
              id: "b3",
              type: "bullets",
              marker: "dot",
              align: "justify",
              items: [
                "Engaged in an intensive, peer-to-peer learning environment that emphasizes problem-solving, critical thinking, and autonomous learning.",
                "Developed a deep understanding of software engineering principles through a series of increasingly challenging projects, focusing on C programming, algorithms, and system design.",
                "Collaborated with peers on complex coding challenges, fostering teamwork and enhancing technical and soft skills necessary for a professional software engineering career.",
              ],
            },
          ],
        },
        {
          id: "sd-bootcamp",
          gap: 20,
          blocks: [
            { id: "b1", type: "title", text: "FULL STACK WEB DEVELOPMENT BOOTCAMP, CERTIFICATION" },
            {
              id: "b2",
              type: "text",
              align: "justify",
              text: "*TheHackerCollective (now known as Sigma School)* **–** 2021",
            },
            {
              id: "b3",
              type: "bullets",
              marker: "dot",
              align: "justify",
              items: [
                "Acquired comprehensive skills in full stack development, including front-end and back-end technologies such as HTML, CSS, JavaScript, React.js, Node.js, Express, and MongoDB.",
                "Built and deployed multiple full-stack applications, demonstrating proficiency in responsive design, RESTful APIs, and database management.",
                "Engaged in collaborative projects, simulating real-world development environments and honing skills in version control, debugging, and deployment on platforms like Heroku and AWS.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "projects",
      title: "PROJECTS",
      column: "right",
      headingGap: 5,
      entries: [
        {
          id: "proj-hr",
          blocks: [
            { id: "b1", type: "title", text: "AI HR Toolkit" },
            {
              id: "b2",
              type: "text",
              size: "xs",
              text:
                "**URL:**\n**[https://ai-hr-toolkit-client-sid-belulok-sebastian-hotmailcoms-projects.vercel.app](https://ai-hr-toolkit-client-sid-belulok-sebastian-hotmailcoms-projects.vercel.app)**\n" +
                "**Github:**\n**[https://github.com/belulok/ai-hr-toolkit-client-side](https://github.com/belulok/ai-hr-toolkit-client-side) [https://github.com/belulok/ai-hr-toolkit-server-side](https://github.com/belulok/ai-hr-toolkit-server-side)**",
            },
            {
              id: "b3",
              type: "text",
              align: "justify",
              gap: 10,
              text: "This project is an AI-Powered HR Toolkit that streamlines HR processes by leveraging AI for resume analysis, job matching, email classification, sentiment analysis, and an AI chatbot. It consists of a Flask backend (for API processing & AI integration) and a Next.js frontend (for a user-friendly dashboard).",
            },
            { id: "b4", type: "title", text: "Core Features & AI Implementation:", gap: 10 },
            { id: "b5", type: "text", text: "1. *AI-Powered Resume & Job Matching*" },
            {
              id: "b6",
              type: "bullets",
              marker: "dot",
              align: "justify",
              spacing: 1.6,
              items: [
                "Upload resumes (PDFs) → Extracts text using pdfplumber.",
                "Parses key information (Name, Email, Skills, GPA, etc.) using spaCy (NLP).",
                "Converts text into embeddings using Sentence-BERT (all-mpnet-base-v2).",
                "Stores resume embeddings in PostgreSQL + pgVector for fast similarity search.",
                "Compares resumes to job descriptions using cosine similarity.",
                "Highlights missing skills and suggests relevant learning resources.",
              ],
            },
          ],
        },
        {
          id: "proj-trading",
          blocks: [
            { id: "b1", type: "title", align: "justify", text: "AI-Powered Social Trading Platform Using DeepSeek" },
            {
              id: "b2",
              type: "text",
              size: "xs",
              text:
                "**URL:**\n**[https://zingy-kataifi-fb1af6.netlify.app/](https://zingy-kataifi-fb1af6.netlify.app/)**\n" +
                "**Github:**\n**[https://github.com/belulok/social-trading-platform](https://github.com/belulok/social-trading-platform)**",
            },
            {
              id: "b3",
              type: "text",
              align: "justify",
              gap: 10,
              text: "This project will be an AI-driven social trading platform that helps traders analyze stocks, match traders with the best strategies, and provide real-time AI chatbot assistance for trading-related queries.",
            },
            { id: "b4", type: "title", text: "Core Features & AI Implementation:", gap: 10 },
            { id: "b5", type: "text", indent: 4.5, text: "*1.   AI-Powered Stock & News Analysis*" },
            {
              id: "b6",
              type: "bullets",
              marker: "dot",
              align: "justify",
              spacing: 1.6,
              items: [
                "Fetch real-time stock market data using a stock API (e.g., Alpha Vantage, Finnhub, or Yahoo Finance).",
                "Use DeepSeek embeddings to analyze financial news articles for market sentiment. AI categorizes news into Bullish, Bearish, or Neutral sentiment.",
                "Helps traders make data-driven decisions before copying trades.",
              ],
            },
            { id: "b7", type: "text", indent: 4.5, gap: 10, text: "*2.   AI-Driven Copy Trader Matching*" },
            {
              id: "b8",
              type: "bullets",
              marker: "dot",
              align: "justify",
              spacing: 1.6,
              items: [
                "Collect trader profiles, strategies, risk levels, and trading patterns.",
                "Use DeepSeek embeddings to generate trader profile vectors.",
                "Compare profiles using cosine similarity in pgVector + PostgreSQL.",
              ],
            },
            { id: "b9", type: "text", text: "Match traders to the best strategies based on risk tolerance & success rates" },
          ],
        },
      ],
    },
  ],
};
