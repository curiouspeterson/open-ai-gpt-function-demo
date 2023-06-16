import { NextResponse } from "next/server";

const get_book_details = async (name: string) => {
  console.log("Calling bookDB");
  const bookDBUrl = `https://www.googleapis.com/books/v1/volumes?q=${name}`;
  const bookDBRes = await fetch(bookDBUrl);
  const bookDBData = await bookDBRes.json();
  
  return bookDBData;
};

export async function POST(request: Request) {
  const { prompt } = await request.json();

  // Step 1, send model the user query and what functions it has access to
  const initialBody = {
    model: "gpt-3.5-turbo-0613",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    functions: [
      {
        name: "get_book_details",
        description:
          "Get various details about a book, like ratings, release date, genre, characters, publisher, summary etc.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the book to get the details for",
            },
          },
          required: ["name"],
        },
      },
    ],
    function_call: "auto",
  };

  console.log(`Initial call to GPT with prompt: "${prompt}"`);
  const initialResponse = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(initialBody),
    }
  );

  const data = await initialResponse.json(); 
 
  const message = data?.choices[0]?.message;
  console.log("message: " +message)
  
  // Step 2, check if the model wants to call a function
  if (message.function_call) {
    console.log("Model wants to call a function");
    const functionName = message.function_call?.name;
    const functionArgName = JSON.parse(message.function_call?.arguments)?.name;

    // Step 3, call the function / bookDB API
    const bookDBData = await get_book_details(functionArgName);

    // Step 4, send model the info on the function call and function response
    console.log("Making final call to GPT with the book data");
    const finalBody = {
      model: "gpt-3.5-turbo-16k-0613",
      messages: [
        {
          role: "user",
          content: prompt,
        },
        message,
        {
          role: "function",
          name: functionName,
          content: JSON.stringify(bookDBData),
        },
      ],
    };
    const finalResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(finalBody),
      }
    );

    const finalData = await finalResponse.json();

    return NextResponse.json(finalData.choices[0].message);
  }
  console.log("Normal response from GPT (no function call)");
  return NextResponse.json(message);
}
