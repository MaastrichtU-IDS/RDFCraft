import getOpenAI from "@/utils/useOpenAI";

const generateURI = async (
  previouslyUsedURIs: string[],
  currentlyUsedURIs: string[],
  label: string,
  type: string,
  sourceDescription: string,
  refs: string[],
  prefixes: Record<string, string>[],
) => {
  const { openai, openai_model } = await getOpenAI();

  const explainPrompt = `
    You are a URI generation assistant. Your task is to generate a new URI that follows the established pattern of previously used URIs.
    - The URI you generate must follow the observed URI pattern and use the provided references (columns of the data).
    - Try to avoid generating duplicate URIs (currently used URIs).
    - Instead you can extend existing URIs by adding new segments or modifying existing ones if they are related to each other.
      - ex:car/1 and ex:car/1/engine (A car and its engine)
    - Follow the REST API naming conventions strictly.
    - Try to use listed prefixes as much as possible to help construct the URI.
    - Explain your reasoning behind the generated URI.

    <resourceLabel>
      ${label}
    </resourceLabel>
    <typeOfResource>
      ${type}
    </typeOfResource>
    <previouslyUsedURIsOnOtherTables>
      ${previouslyUsedURIs.join("\n")}
    </previouslyUsedURIsOnOtherTables>
    <currentlyUsedURIs>
      ${currentlyUsedURIs.join("\n")}
    </currentlyUsedURIs>
    <sourceDescription>
      ${sourceDescription}
    </sourceDescription>
    <references>
      ${refs.join("\n")}
    </references>
    <prefixes>
      ${Object.entries(prefixes)
      .map(([key, value]) => `<${key}>${value}</${key}>`)
      .join("\n")}
    </prefixes>
  `;

  const prompt = `
    /no_think
    Now JUST return the generated URI without any explanation based on your understanding of the provided information.
  `;

  const explain = await openai.chat.completions.create({
    model: openai_model,
    messages: [
      {
        role: 'user',
        content: explainPrompt
      }
    ]
  });

  const response = await openai.chat.completions.create({
    model: openai_model,
    messages: [

      {
        role: 'user',
        content: explainPrompt
      },
      {
        role: 'assistant',
        content: explain.choices[0].message.content
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  return response.choices[0].message.content?.trim();
};




export default generateURI;