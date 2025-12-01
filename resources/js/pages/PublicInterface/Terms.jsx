import React from 'react';

// Standalone Terms & Conditions content component.
// Used both inside the About the Data modal (as a tab)
// and by the Auth Terms modal.
export default function Terms() {
  const sections = [
    {
      title: 'Acceptance of Terms',
      body: [
        'By accessing or using the LakeView PH web application ("System"), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these Terms, you must discontinue use of the System.',
        'If you create an account as a Super Administrator, Organization Administrator, Contributor, or Registered User, you confirm that the information you provide is accurate and that you are authorized to use the System on behalf of yourself or your organization.'
      ]
    },
    {
      title: 'Purpose of the System',
      body: [
        'LakeView PH is an information and decision-support platform designed to visualize, manage, and analyze data related to lakes, watersheds, population density, and water quality in the Philippines. The System is intended for use by government agencies, partner organizations, researchers, and the general public for educational, research, planning, and environmental management purposes.',
        'The System is not intended to replace official government advisories, legal documents, or regulatory decisions.'
      ]
    },
    {
      title: 'Appropriate Use of the System',
      body: [
        'Use the System only for lawful purposes.',
        'Refrain from uploading, sharing, or transmitting any content that is illegal, harmful, defamatory, discriminatory, or misleading.',
        'Avoid attempting to bypass or interfere with security features, authentication mechanisms, or access controls.',
        'Refrain from reverse engineering, automated scraping, or bulk extraction of data without prior written consent from the System owners or administrators.',
        'Respect system limitations (e.g., rate limits, upload limits) to avoid degrading performance for other users.',
        'The System administrators reserve the right to suspend or restrict access for users who violate these terms or abuse the platform.'
      ]
    },
    {
      title: 'User Accounts and Roles',
      body: [
        'LakeView PH supports several user roles, including but not limited to:',
        'Super Administrator – manages organizations, users, system-wide data, and configurations.',
        'Organization Administrator – manages members, sampling events, and organization-scoped data.',
        'Contributor – submits and manages own water quality sampling data.',
        'Registered User / Guest – views data, generates charts, and submits feedback.',
        'You are responsible for all actions performed under your account. You agree to:',
        'Keep your login credentials confidential.',
        'Notify the System administrators immediately if you suspect unauthorized access to your account.',
        'Ensure that any data you submit is as accurate and truthful as possible to the best of your knowledge.'
      ]
    },
    {
      title: 'Data Collected and How It Is Used',
      body: [
        'The System may collect the following types of data:',
        'Account Information – such as name, email address, organization, and role.',
        'Usage Data – such as pages visited, actions taken, and time of access, for system monitoring and improvement.',
        'Environmental and Scientific Data – such as lake attributes, sampling events, water quality parameters, and metadata about the data source and collection.',
        'Data may be used for:',
        'Displaying and analyzing lake and environmental information.',
        'Generating statistical charts, reports, and summaries.',
        'Improving system performance, usability, and reliability.',
        'Supporting research, planning, and decision-making by authorized stakeholders.',
        'Aggregated or anonymized data may be used for publications, reports, or public dashboards where individual users are not personally identified.'
      ]
    },
    {
      title: 'Data Sharing and Ownership',
      body: [
        'Data submitted by organizations or contributors may remain under the ownership of the submitting entity, subject to agreements with the project sponsors or governing agencies.',
        'By submitting data to LakeView PH, you grant the System and its administrators a non-exclusive right to store, process, and display the data within the platform for its intended purposes.',
        'Sensitive or restricted datasets may only be shared or published according to agreements with the data owner and applicable policies.'
      ]
    },
    {
      title: 'Passwords, Security, and Authentication',
      body: [
        'The System uses secure authentication mechanisms to protect user accounts. Passwords are stored using hashed formats (e.g., bcrypt via the database provider) and are not stored as plain text.',
        'You agree to:',
        'Choose a strong password and keep it confidential.',
        'Not share your credentials with other users.',
        'Promptly update your password if you suspect that your account has been compromised.',
        'The System may:',
        'Send confirmation emails for registration and password reset.',
        'Use tokens for session management, which may be invalidated after logout, inactivity, or security-related changes.',
        'Temporarily block or limit login attempts to protect against abuse or brute-force attacks.'
      ]
    },
    {
      title: 'Accuracy and Limitations of Information',
      body: [
        'While LakeView PH aims to provide accurate and updated information, the System:',
        'May contain data that is incomplete, outdated, or subject to change.',
        'Provides analytical outputs and visualizations for decision support only and not as official certification of water quality or legal status.'
      ]
    },
    {
      title: 'Availability and System Changes',
      body: [
        'The System may occasionally be unavailable due to:',
        'Maintenance, updates, or system improvements.',
        'Network or hosting issues.',
        'Unforeseen technical problems.'
      ]
    },
    {
      title: 'Prohibited Content and Behavior',
      body: [
        'You agree not to:',
        'Upload malicious code, malware, or any content that could harm the System or other users.',
        'Misrepresent your identity or affiliation.',
        'Manipulate or falsify data with the intent to mislead other users or decision-makers.',
        'Use the System to harass, threaten, or abuse individuals or organizations.',
        'Violations may result in account suspension, removal of data, or reporting to appropriate authorities when necessary.'
      ]
    },
    {
      title: 'Intellectual Property',
      body: [
        'Unless otherwise indicated, the System\'s interface, design, and software components are the property of the project team or its partner institutions. Some map layers, base maps, and analytical tools may rely on third-party services or open data sources, which are subject to their own licenses and terms.',
        'Users must respect any applicable licenses, attributions, and citation requirements for maps, datasets, and reports generated using LakeView PH.'
      ]
    },
    {
      title: 'Disclaimer and Limitation of Liability',
      body: [
        'LakeView PH is provided "as is" for informational and research purposes. To the extent permitted by law:',
        'The project team and associated institutions are not liable for any direct, indirect, or incidental damages arising from the use or inability to use the System.',
        'Users are responsible for how they interpret and apply the information retrieved from the System.'
      ]
    },
    {
      title: 'Contact Information',
      body: [
        'For questions, feedback, or concerns regarding LakeView PH or these Terms and Conditions, you may contact the system administrators at: bantaylawa.ph@gmail.com',
        'This Terms and Conditions document is part of a capstone/research system and may be further revised in coordination with the client and institutional policies.'
      ]
    }
  ];

  return (
    <div className="terms-content">
      <h2>LakeView PH - Terms and Conditions</h2>
      <p><em>Last Updated: November 29, 2025</em></p>
      {sections.map((sec, i) => (
        <section key={sec.title}>
          <h3>{i + 1}. {sec.title}</h3>
          {sec.body.length > 1 ? (
            <ul>
              {sec.body.map(line => <li key={line}>{line}</li>)}
            </ul>
          ) : (
            <p>{sec.body[0]}</p>
          )}
        </section>
      ))}
      <p className="terms-footer-note">This document is part of a capstone/research system and may be further revised in coordination with the client and institutional policies.</p>
    </div>
  );
}
