import React, { useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { moduleDocs } from '../data/moduleDocs';
import PageHeader from '../components/PageHeader';

const ModuleDocs = () => {
  const { moduleName } = useParams();
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#templates') {
      const element = document.getElementById('templates');
      if (element) {
        setTimeout(() => element.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  }, [location.hash]);

  // If module docs don't exist, fallback to 404 or a generic message
  const docs = moduleDocs[moduleName];

  if (!docs) {
    return (
      <div className="container" style={{ maxWidth: '800px', padding: '2rem 1rem', textAlign: 'center' }}>
        <PageHeader
          icon={BookOpen}
          title="Documentation Not Found"
          subtitle="We couldn't find the documentation for this module."
        />
      </div>
    );
  }

  const currentDocs = docs.en;

  return (
    <div className="container" style={{ maxWidth: '800px', padding: '1rem' }}>

      <PageHeader
        icon={BookOpen}
        title={`${currentDocs.title} Docs`}
        subtitle={currentDocs.description}
      />

      {/* Content Sections */}
      <div className="card" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid var(--border-color)' }}>
        
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ color: 'var(--primary)', fontSize: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            What is it?
          </h2>
          <p style={{ color: 'var(--text-main)', lineHeight: '1.6' }}>
            {currentDocs.whatIsIt}
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ color: 'var(--primary)', fontSize: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            How to use it
          </h2>
          <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', color: 'var(--text-main)' }}>
            {currentDocs.howToUse.map((step, index) => (
              <li key={index} style={{ marginBottom: '0.5rem', lineHeight: '1.5' }}>
                {step}
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ color: 'var(--primary)', fontSize: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Rules & Guidelines
          </h2>
          <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', color: 'var(--text-main)' }}>
            {currentDocs.rules.map((rule, index) => (
              <li key={index} style={{ marginBottom: '0.5rem', lineHeight: '1.5' }}>
                {rule}
              </li>
            ))}
          </ul>
        </section>

        {currentDocs.fruits && (
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ color: 'var(--primary)', fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              The Fruits of the Holy Spirit
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
              {currentDocs.fruits.map((fruit, index) => (
                <div key={index} style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ color: 'var(--primary)', fontSize: '1.1rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                    {fruit.name}
                  </h3>
                  <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                    {fruit.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentDocs.templates && (
          <section id="templates">
            <h2 style={{ color: 'var(--primary)', fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Reference Templates
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {currentDocs.templates.map((template, index) => (
                <div key={index} style={{ backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ color: 'var(--text-main)', fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    {template.title}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    {template.description}
                  </p>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Structure:</h4>
                    <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', color: 'var(--text-main)' }}>
                      {template.structure.map((item, i) => (
                        <li key={i} style={{ marginBottom: '0.25rem' }}>
                          <strong>{item.label}:</strong> {item.text}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Example:</h4>
                    <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)', whiteSpace: 'pre-line' }}>
                      {template.example.split('\n').map((line, i) => {
                        const colonIndex = line.indexOf(':');
                        if (colonIndex === -1) {
                          return <p key={i} style={{ color: 'var(--text-main)', margin: 0 }}>{line}</p>;
                        }
                        const label = line.substring(0, colonIndex);
                        const rest = line.substring(colonIndex + 1);
                        return (
                          <p key={i} style={{ color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>
                            <strong>{label}:</strong>{rest}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

    </div>
  );
};

export default ModuleDocs;
