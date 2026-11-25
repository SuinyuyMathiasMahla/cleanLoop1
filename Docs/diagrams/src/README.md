# Diagram sources

Each diagram is generated as HTML and rendered to PNG at 3x with headless Chrome:

    node uc.js      # use case diagram
    node arch.js    # cloud architecture
    node act.js     # activity diagrams (Figures 5 and 6)
    ./render.ps1 <name>

arch.js expects the official AWS icon package unzipped into ../awsicons
(https://aws.amazon.com/architecture/icons/). Fonts load from Google Fonts.
