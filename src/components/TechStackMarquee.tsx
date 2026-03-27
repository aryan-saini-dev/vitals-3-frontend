const techs = [
  "ElevenLabs", "Twilio", "Vapi", "Deepgram", "LangChain", "Supabase", "GPT", "RAG Pipeline",
  "ElevenLabs", "Twilio", "Vapi", "Deepgram", "LangChain", "Supabase", "GPT", "RAG Pipeline",
];

const TechStackMarquee = () => {
  return (
    <section className="py-12 border-y-2 border-foreground overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {techs.map((tech, i) => (
          <span
            key={i}
            className="mx-6 md:mx-10 font-heading font-bold text-lg md:text-2xl text-foreground opacity-30"
          >
            {tech}
          </span>
        ))}
      </div>
    </section>
  );
};

export default TechStackMarquee;
